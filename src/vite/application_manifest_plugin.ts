import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { glob } from "glob";
import { gqlPluckFromCodeStringSync } from "@graphql-tools/graphql-tag-pluck";
import { createHash } from "crypto";
import {
  ArgumentNode,
  Kind,
  ListTypeNode,
  NamedTypeNode,
  NonNullTypeNode,
  parse,
  print,
  TypeNode,
  ValueNode,
  visit,
  type DocumentNode,
  type OperationDefinitionNode,
} from "graphql";
import { ApolloClient, ApolloLink, InMemoryCache } from "@apollo/client";
import Observable from "rxjs";
import path from "path";

const root = process.cwd();

const getRawValue = (node: ValueNode): any => {
  switch (node.kind) {
    case Kind.STRING:
    case Kind.BOOLEAN:
      return node.value;
    case Kind.LIST:
      return node.values.map(getRawValue);
    case Kind.OBJECT:
      return node.fields.reduce<Record<string, any>>((acc, field) => {
        acc[field.name.value] = getRawValue(field.value);
        return acc;
      }, {});
    default:
      throw new Error(
        `Error when parsing directive values: unexpected type '${node.kind}'`
      );
  }
};

const getTypedDirectiveArgument = (
  argumentName: string,
  expectedType: Kind,
  directiveArguments: readonly ArgumentNode[] | undefined
) => {
  if (!directiveArguments || directiveArguments.length === 0) {
    return undefined;
  }

  let argument = directiveArguments.find(
    (directiveArgument) => directiveArgument.name.value === argumentName
  );

  if (!argument) {
    return undefined;
  }

  if (argument.value.kind != expectedType) {
    throw new Error(
      `Expected argument '${argumentName}' to be of type '${expectedType}' but found '${argument.value.kind}' instead.`
    );
  }

  return getRawValue(argument.value);
};

function getTypeName(type: TypeNode): string {
  let t = type;
  while (t.kind === "NonNullType" || t.kind === "ListType") {
    t = (t as NonNullTypeNode | ListTypeNode).type;
  }
  return (t as NamedTypeNode).name.value;
}

export const ApplicationManifestPlugin = () => {
  const cache = new Map();
  let packageJson: any = null;
  let config: any = null;

  const clientCache = new InMemoryCache();
  const client = new ApolloClient({
    cache: clientCache,
    link: new ApolloLink((operation) => {
      const body = print(
        removeClientDirective(sortTopLevelDefinitions(operation.query))
      );
      const name = operation.operationName;
      const variables = (
        operation.query.definitions.find(
          (d) => d.kind === "OperationDefinition"
        ) as OperationDefinitionNode
      ).variableDefinitions?.reduce(
        (obj, varDef) => ({
          ...obj,
          [varDef.variable.name.value]: getTypeName(varDef.type),
        }),
        {}
      );
      const type = (
        operation.query.definitions.find(
          (d) => d.kind === "OperationDefinition"
        ) as OperationDefinitionNode
      ).operation;
      const prefetch = (
        operation.query.definitions.find(
          (d) => d.kind === "OperationDefinition"
        ) as OperationDefinitionNode
      ).directives?.some((d) => d.name.value === "prefetch");
      const id = createHash("sha256").update(body).digest("hex");
      // TODO: For now, you can only have 1 operation marked as prefetch. In the future, we'll likely support more than 1, and the "prefetchId" will be defined on the `@prefetch` itself as an argument
      const prefetchID = prefetch ? "__anonymous" : undefined;

      const tools = (
        operation.query.definitions.find(
          (d) => d.kind === "OperationDefinition"
        ) as OperationDefinitionNode
      ).directives
        ?.filter((d) => d.name.value === "tool")
        .map((directive) => {
          const name = getTypedDirectiveArgument(
            "name",
            Kind.STRING,
            directive.arguments
          );
          const description = getTypedDirectiveArgument(
            "description",
            Kind.STRING,
            directive.arguments
          );
          const extraInputs = getTypedDirectiveArgument(
            "extraInputs",
            Kind.LIST,
            directive.arguments
          );

          if (!name) {
            throw new Error("'name' argument must be supplied for @tool");
          }

          if (name.indexOf(" ") > -1) {
            throw new Error(
              `Tool with name "${name}" contains spaces which is not allowed.`
            );
          }

          if (!description) {
            throw new Error(
              "'description' argument must be supplied for @tool"
            );
          }

          return {
            name,
            description,
            extraInputs,
          };
        });

      return Observable.of({
        data: { id, name, type, body, variables, prefetch, prefetchID, tools },
      });
    }),
  });

  const processFile = async (file: string) => {
    const code = readFileSync(file, "utf-8");

    if (!code.includes("gql")) return;

    const fileHash = createHash("md5").update(code).digest("hex");
    if (cache.get("file")?.hash === fileHash) return;
    const sources = await gqlPluckFromCodeStringSync(file, code, {
      modules: [
        { name: "graphql-tag", identifier: "gql" },
        { name: "@apollo/client", identifier: "gql" },
      ],
    }).map((source) => ({
      node: parse(source.body),
      file,
      location: source.locationOffset,
    }));

    const operations = [];
    for (const source of sources) {
      const type = (
        source.node.definitions.find(
          (d) => d.kind === "OperationDefinition"
        ) as OperationDefinitionNode
      ).operation;

      let result;
      if (type === "query") {
        result = await client.query({
          query: source.node,
          fetchPolicy: "no-cache",
        });
      } else if (type === "mutation") {
        result = await client.mutate({
          mutation: source.node,
          fetchPolicy: "no-cache",
        });
      } else {
        throw new Error(
          "Found an unsupported operation type. Only Query and Mutation are supported."
        );
      }
      operations.push(result.data);
    }

    cache.set(file, {
      file: file,
      hash: fileHash,
      operations,
    });
  };

  const generateManifest = async () => {
    const operations = Array.from(cache.values()).flatMap(
      (entry) => entry.operations
    );
    if (operations.filter((o) => o.prefetch).length > 1) {
      throw new Error(
        "Found multiple operations marked as `@prefetch`. You can only mark 1 operation with `@prefetch`."
      );
    }

    let resource = "";
    if (config.command === "serve") {
      resource =
        packageJson.entry?.[config.mode] ??
        `http${config.server.https ? "s" : ""}://${config.server.host ?? "localhost"}:${config.server.port}`;
    } else {
      let entryPoint = packageJson.entry?.[config.mode];
      if (entryPoint) {
        resource = entryPoint;
      } else if (config.mode === "production") {
        resource = "index.html";
      } else {
        throw new Error(
          `No entry point found for mode "${config.mode}". Entry points other than "development" and "production" must be defined in package.json file.`
        );
      }
    }

    const manifest = {
      format: "apollo-ai-app-manifest",
      version: "1",
      name: packageJson.name,
      description: packageJson.description,
      hash: createHash("sha256").update(Date.now().toString()).digest("hex"),
      operations: Array.from(cache.values()).flatMap(
        (entry) => entry.operations
      ),
      resource,
      csp: {
        connectDomains: packageJson.csp?.connectDomains ?? [],
        resourceDomains: packageJson.csp?.resourceDomains ?? [],
      },
    };

    // Always write to build directory so the MCP server picks it up
    const dest = path.resolve(
      root,
      config.build.outDir,
      ".application-manifest.json"
    );
    mkdirSync(path.dirname(dest), { recursive: true });
    writeFileSync(dest, JSON.stringify(manifest));

    // Always write to the dev location so that the app can bundle the manifest content
    writeFileSync(".application-manifest.json", JSON.stringify(manifest));
  };

  return {
    name: "OperationManifest",

    async configResolved(resolvedConfig: any) {
      config = resolvedConfig;
    },

    async buildStart() {
      // Read package.json on start
      packageJson = JSON.parse(readFileSync("package.json", "utf-8"));

      // Scan all files on startup
      const files = await glob("src/**/*.{ts,tsx,js,jsx}");

      for (const file of files) {
        const fullPath = path.resolve(root, file);
        await processFile(fullPath);
      }

      // We don't want to do this here on builds cause it just gets overwritten anyways. We'll call it on writeBundle instead.
      if (config.command === "serve") {
        await generateManifest();
      }
    },

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    configureServer(server: any) {
      server.watcher.on("change", async (file: string) => {
        if (file.endsWith("package.json")) {
          packageJson = JSON.parse(readFileSync("package.json", "utf-8"));
          await generateManifest();
        } else if (file.match(/\.(jsx?|tsx?)$/)) {
          await processFile(file);
          await generateManifest();
        }
      });
    },

    async writeBundle() {
      await generateManifest();
    },
  };
};

// Sort the definitions in this document so that operations come before fragments,
// and so that each kind of definition is sorted by name.
export function sortTopLevelDefinitions(query: DocumentNode): DocumentNode {
  const definitions = [...query.definitions];
  // We want to avoid unnecessary dependencies, so write out a comparison
  // function instead of using _.orderBy.
  definitions.sort((a, b) => {
    // This is a reverse sort by kind, so that OperationDefinition precedes FragmentDefinition.
    if (a.kind > b.kind) {
      return -1;
    }
    if (a.kind < b.kind) {
      return 1;
    }

    // Extract the name from each definition. Jump through some hoops because
    // non-executable definitions don't have to have names (even though any
    // DocumentNode actually passed here should only have executable
    // definitions).
    const aName =
      a.kind === "OperationDefinition" || a.kind === "FragmentDefinition" ?
        (a.name?.value ?? "")
      : "";
    const bName =
      b.kind === "OperationDefinition" || b.kind === "FragmentDefinition" ?
        (b.name?.value ?? "")
      : "";

    // Sort by name ascending.
    if (aName < bName) {
      return -1;
    }
    if (aName > bName) {
      return 1;
    }

    // Assuming that the document is "valid", no operation or fragment name can appear
    // more than once, so we don't need to differentiate further to have a deterministic
    // sort.
    return 0;
  });
  return {
    ...query,
    definitions,
  };
}

function removeClientDirective(doc: DocumentNode) {
  return visit(doc, {
    OperationDefinition(node) {
      return {
        ...node,
        directives: node.directives?.filter(
          (d) => d.name.value !== "prefetch" && d.name.value !== "tool"
        ),
      };
    },
  });
}
