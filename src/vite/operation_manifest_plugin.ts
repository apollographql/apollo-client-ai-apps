import { readFileSync, writeFileSync } from "fs";
import { glob } from "glob";
import { gqlPluckFromCodeStringSync } from "@graphql-tools/graphql-tag-pluck";
import { createHash } from "crypto";
import { parse, print, visit, type DocumentNode, type OperationDefinitionNode } from "graphql";
import { ApolloClient, ApolloLink, InMemoryCache } from "@apollo/client";
import Observable from "rxjs";
import path from "path";
import fs from "fs";

const root = process.cwd();

export const OperationManifestPlugin = () => {
  const cache = new Map();

  const clientCache = new InMemoryCache();
  const client = new ApolloClient({
    cache: clientCache,
    link: new ApolloLink((operation) => {
      const body = print(removePrefetchDirective(sortTopLevelDefinitions(operation.query)));
      const name = operation.operationName;
      const type = (
        operation.query.definitions.find((d) => d.kind === "OperationDefinition") as OperationDefinitionNode
      ).operation;
      const prefetch = (
        operation.query.definitions.find((d) => d.kind === "OperationDefinition") as OperationDefinitionNode
      ).directives?.some((d) => d.name.value === "prefetch");
      const id = createHash("sha256").update(body).digest("hex");

      return Observable.of({ data: { id, name, type, body, prefetch } });
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
      const result = await client.query({ query: source.node, fetchPolicy: "no-cache" });
      operations.push(result.data);
    }

    cache.set(file, {
      file: file,
      hash: fileHash,
      operations,
    });
  };

  const generateManifest = async () => {
    const manifest = {
      format: "apollo-persisted-query-manifest",
      version: 1,
      operations: Array.from(cache.values()).flatMap((entry) => entry.operations),
    };
    writeFileSync(".operation-manifest.json", JSON.stringify(manifest));
  };

  return {
    name: "OperationManifest",

    async buildStart() {
      // Scan all files on startup
      const files = await glob("src/**/*.{ts,tsx,js,jsx}");

      for (const file of files) {
        const fullPath = path.resolve(root, file);
        await processFile(fullPath);
      }
      await generateManifest();
    },

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    configureServer(server: any) {
      server.watcher.on("change", async (file: string) => {
        if (file.match(/\.(jsx?|tsx?)$/)) {
          await processFile(file);
          await generateManifest();
        }
      });
    },

    writeBundle() {
      const src = path.resolve(root, ".operation-manifest.json");
      const dest = path.resolve(root, "dist/.operation-manifest.json");
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(src, dest);
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
    const aName = a.kind === "OperationDefinition" || a.kind === "FragmentDefinition" ? a.name?.value ?? "" : "";
    const bName = b.kind === "OperationDefinition" || b.kind === "FragmentDefinition" ? b.name?.value ?? "" : "";

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

function removePrefetchDirective(doc: DocumentNode) {
  return visit(doc, {
    OperationDefinition(node) {
      return {
        ...node,
        directives: node.directives?.filter((d) => d.name.value !== "prefetch"),
      };
    },
  });
}
