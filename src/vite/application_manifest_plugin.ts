import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { glob } from "glob";
import { gqlPluckFromCodeStringSync } from "@graphql-tools/graphql-tag-pluck";
import { createHash } from "crypto";
import type {
  ArgumentNode,
  ListTypeNode,
  NamedTypeNode,
  NonNullTypeNode,
  TypeNode,
  ValueNode,
  DocumentNode,
  OperationDefinitionNode,
  DirectiveNode,
} from "graphql";
import { Kind, parse, print } from "graphql";
import { ApolloClient, ApolloLink, InMemoryCache } from "@apollo/client";
import { removeDirectivesFromDocument } from "@apollo/client/utilities/internal";
import { of } from "rxjs";
import path from "path";
import type {
  ApplicationManifest,
  ManifestExtraInput,
  ManifestLabels,
  ManifestTool,
  ManifestWidgetSettings,
} from "../types/application-manifest.js";

const root = process.cwd();

function getRawValue(node: ValueNode): unknown {
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
}

function getArgumentValue(
  argument: ArgumentNode,
  expectedType: Kind.STRING
): string;

function getArgumentValue(
  argument: ArgumentNode,
  expectedType: Kind.BOOLEAN
): boolean;

function getArgumentValue(
  argument: ArgumentNode,
  expectedType: Kind.LIST
): unknown[];

function getArgumentValue(
  argument: ArgumentNode,
  expectedType: Kind.OBJECT
): Record<string, unknown>;

function getArgumentValue(argument: ArgumentNode, expectedType: Kind) {
  const argumentType = argument.value.kind;

  invariant(
    argumentType === expectedType,
    `Expected argument '${argument.name.value}' to be of type '${expectedType}' but found '${argumentType}' instead.`
  );

  return getRawValue(argument.value);
}

interface GetArgumentNodeOptions {
  required?: boolean;
}

function getDirectiveArgument(
  argumentName: string,
  directive: DirectiveNode,
  opts: GetArgumentNodeOptions & { required: true }
): ArgumentNode;

function getDirectiveArgument(
  argumentName: string,
  directive: DirectiveNode,
  opts?: GetArgumentNodeOptions
): ArgumentNode | undefined;

function getDirectiveArgument(
  argumentName: string,
  directive: DirectiveNode,
  { required = false }: { required?: boolean } = {}
) {
  const argument = directive.arguments?.find(
    (directiveArgument) => directiveArgument.name.value === argumentName
  );

  invariant(
    argument || !required,
    `'${argumentName}' argument must be supplied for @tool`
  );

  return argument;
}

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
      const definition = operation.query.definitions.find(
        (d) => d.kind === "OperationDefinition"
      );

      // Use `operation.query` so that the error reflects the end-user defined
      // document, not our sorted one
      invariant(
        definition,
        `Document does not contain an operation:\n${print(operation.query)}`
      );

      const { directives, operation: type } = definition;

      const variables = definition.variableDefinitions?.reduce(
        (obj, varDef) => ({
          ...obj,
          [varDef.variable.name.value]: getTypeName(varDef.type),
        }),
        {}
      );

      const prefetch = directives?.some((d) => d.name.value === "prefetch");
      const id = createHash("sha256").update(body).digest("hex");
      // TODO: For now, you can only have 1 operation marked as prefetch. In the future, we'll likely support more than 1, and the "prefetchId" will be defined on the `@prefetch` itself as an argument
      const prefetchID = prefetch ? "__anonymous" : undefined;

      const tools = directives
        ?.filter((d) => d.name.value === "tool")
        .map((directive) => {
          const name = getArgumentValue(
            getDirectiveArgument("name", directive, { required: true }),
            Kind.STRING
          );

          invariant(
            name.indexOf(" ") === -1,
            `Tool with name "${name}" contains spaces which is not allowed.`
          );

          const description = getArgumentValue(
            getDirectiveArgument("description", directive, { required: true }),
            Kind.STRING
          );

          const extraInputsNode = getDirectiveArgument(
            "extraInputs",
            directive
          );

          const labelsNode = getDirectiveArgument("labels", directive);

          const toolOptions: ManifestTool = {
            name,
            description,
          };

          if (extraInputsNode) {
            toolOptions.extraInputs = getArgumentValue(
              extraInputsNode,
              Kind.LIST
            ) as ManifestExtraInput[];
          }

          if (labelsNode) {
            const labels = getLabelsFromConfig(
              getArgumentValue(labelsNode, Kind.OBJECT)
            );

            if (labels) {
              toolOptions.labels = labels;
            }
          }

          return toolOptions;
        });

      // TODO: Make this object satisfy the `ManifestOperation` type. Currently
      // it errors because we need more validation on a few of these fields
      return of({
        data: { id, name, type, body, variables, prefetch, prefetchID, tools },
      });
    }),
  });

  const processFile = async (file: string) => {
    const code = readFileSync(file, "utf-8");

    if (!code.includes("gql")) return;

    const fileHash = createHash("md5").update(code).digest("hex");
    if (cache.get("file")?.hash === fileHash) return;
    const sources = gqlPluckFromCodeStringSync(file, code, {
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

    invariant(
      operations.filter((o) => o.prefetch).length <= 1,
      "Found multiple operations marked as `@prefetch`. You can only mark 1 operation with `@prefetch`."
    );

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

    const manifest: ApplicationManifest = {
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
        frameDomains: packageJson.csp?.frameDomains ?? [],
        redirectDomains: packageJson.csp?.redirectDomains ?? [],
        resourceDomains: packageJson.csp?.resourceDomains ?? [],
      },
    };

    if (
      packageJson.widgetSettings &&
      isNonEmptyObject(packageJson.widgetSettings)
    ) {
      function validateWidgetSetting(
        key: keyof ManifestWidgetSettings,
        type: "string" | "boolean"
      ) {
        if (key in widgetSettings) {
          invariant(
            typeof widgetSettings[key] === type,
            `Expected 'widgetSettings.${key}' to be of type '${type}' but found '${typeof widgetSettings[key]}' instead.`
          );
        }
      }

      const widgetSettings =
        packageJson.widgetSettings as ManifestWidgetSettings;

      validateWidgetSetting("prefersBorder", "boolean");
      validateWidgetSetting("description", "string");
      validateWidgetSetting("domain", "string");

      manifest.widgetSettings = packageJson.widgetSettings;
    }

    if (packageJson.labels) {
      const labels = getLabelsFromConfig(packageJson.labels);

      if (labels) {
        manifest.labels = labels;
      }
    }

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

interface LabelConfig {
  toolInvocation?: {
    invoking?: string;
    invoked?: string;
  };
}

function getLabelsFromConfig(config: LabelConfig): ManifestLabels | undefined {
  if (!("toolInvocation" in config)) {
    return;
  }

  const { toolInvocation } = config;
  const labels: ManifestLabels = {};

  if (Object.hasOwn(toolInvocation, "invoking")) {
    validateType(toolInvocation.invoking, "string", {
      propertyName: "labels.toolInvocation.invoking",
    });

    labels["toolInvocation/invoking"] = toolInvocation.invoking;
  }

  if (Object.hasOwn(toolInvocation, "invoked")) {
    validateType(toolInvocation.invoked, "string", {
      propertyName: "labels.toolInvocation.invoked",
    });

    labels["toolInvocation/invoked"] = toolInvocation.invoked;
  }

  if (isNonEmptyObject(labels)) {
    return labels;
  }
}

function removeClientDirective(doc: DocumentNode) {
  return removeDirectivesFromDocument(
    [{ name: "prefetch" }, { name: "tool" }],
    doc
  )!;
}

function invariant(condition: any, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

// possible values of `typeof`
type TypeofResult =
  | "string"
  | "number"
  | "bigint"
  | "boolean"
  | "symbol"
  | "undefined"
  | "object"
  | "function";

type TypeofResultToConcreteType<T extends TypeofResult> =
  T extends "string" ? string
  : T extends "number" ? number
  : T extends "bigint" ? bigint
  : T extends "boolean" ? boolean
  : T extends "symbol" ? symbol
  : T extends "undefined" ? undefined
  : T extends "object" ? object
  : T extends "function" ? Function
  : never;

function validateType<Typeof extends TypeofResult>(
  value: unknown,
  expectedType: Typeof,
  options: { propertyName: string }
): asserts value is TypeofResultToConcreteType<Typeof> {
  invariant(
    typeof value === expectedType,
    `Expected '${options.propertyName}' to be of type '${expectedType}' but found '${typeof value}' instead.`
  );
}

function isNonEmptyObject(obj: object) {
  return Object.keys(obj).length > 0;
}
