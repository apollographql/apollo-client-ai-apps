import {
  defaultClientConditions,
  type Environment,
  type Plugin,
  type ResolvedConfig,
} from "vite";
import { createHash } from "node:crypto";
import path from "node:path";
import fs from "node:fs";
import { ApolloClient, ApolloLink, type DocumentNode } from "@apollo/client";
import { InMemoryCache } from "@apollo/client";
import { gqlPluckFromCodeStringSync } from "@graphql-tools/graphql-tag-pluck";
import { glob } from "glob";
import { print } from "@apollo/client/utilities";
import { removeDirectivesFromDocument } from "@apollo/client/utilities/internal";
import { of } from "rxjs";
import { Kind, parse, type OperationDefinitionNode } from "graphql";
import {
  getArgumentValue,
  getDirectiveArgument,
  getTypeName,
} from "./utilities/graphql";
import type {
  ApplicationManifest,
  ManifestExtraInput,
  ManifestLabels,
  ManifestOperation,
  ManifestTool,
  ManifestWidgetSettings,
} from "../types/application-manifest";
import { invariant } from "../utilities/invariant.js";
import { explorer } from "./utilities/config.js";
import type { ApolloAiAppsConfig } from "../config/index.js";

export declare namespace apolloClientAiApps {
  export type Target = ApolloAiAppsConfig.AppTarget;

  export interface Options {
    targets: Target[];
    devTarget?: Target | undefined;
  }
}

const root = process.cwd();

const VALID_TARGETS: apolloClientAiApps.Target[] = ["openai", "mcp"];

function isValidTarget(target: unknown): target is apolloClientAiApps.Target {
  return VALID_TARGETS.includes(target as apolloClientAiApps.Target);
}

function buildExtensions(target: apolloClientAiApps.Target) {
  return [".mjs", ".js", ".mts", ".ts", ".jsx", ".tsx", ".json"].flatMap(
    (ext) => [`.${target}${ext}`, ext]
  );
}

export function devTarget(target: string | undefined) {
  invariant(
    target === undefined || isValidTarget(target),
    `devTarget '${target}' is not a valid dev target. Must be one of ${VALID_TARGETS.join(", ")}.`
  );

  return target;
}

interface FileCache {
  file: string;
  hash: string;
  operations: ManifestOperation[];
}

export function apolloClientAiApps(
  options: apolloClientAiApps.Options
): Plugin {
  const targets = Array.from(new Set(options.targets));
  const { devTarget = targets.length === 1 ? targets[0] : undefined } = options;
  const cache = new Map<string, FileCache>();

  let packageJson!: Record<string, any>;
  let config!: ResolvedConfig;

  invariant(
    Array.isArray(targets) && targets.length > 0,
    "The `targets` option must be a non-empty array"
  );

  invariant(
    targets.every(isValidTarget),
    `All targets must be one of: ${VALID_TARGETS.join(", ")}`
  );

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: processQueryLink,
  });

  async function processFile(file: string) {
    const code = fs.readFileSync(file, "utf-8");

    if (!code.includes("gql")) return;

    const fileHash = createHash("md5").update(code).digest("hex");
    if (cache.get(file)?.hash === fileHash) return;
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

    const operations: ManifestOperation[] = [];
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
      operations.push(result.data as ManifestOperation);
    }

    cache.set(file, {
      file: file,
      hash: fileHash,
      operations,
    });
  }

  async function generateManifest(environment?: Environment) {
    const appsConfig = await getAppsConfig();
    const operations = Array.from(cache.values()).flatMap(
      (entry) => entry.operations
    );

    invariant(
      operations.filter((o) => o.prefetch).length <= 1,
      "Found multiple operations marked as `@prefetch`. You can only mark 1 operation with `@prefetch`."
    );

    function getBuildResourceForTarget(target: apolloClientAiApps.Target) {
      const entryPoint = getResourceFromConfig(appsConfig, config.mode, target);

      if (entryPoint) {
        return entryPoint;
      }

      if (config.mode === "production") {
        return `${target}/index.html`;
      }

      throw new Error(
        `No entry point found for mode "${config.mode}". Entry points other than "development" and "production" must be defined in package.json file.`
      );
    }

    let resource: ApplicationManifest["resource"];
    if (config.command === "serve") {
      // Dev mode: resource is a string (dev server URL)
      resource =
        getResourceFromConfig(appsConfig, config.mode, devTarget!) ??
        `http${config.server.https ? "s" : ""}://${config.server.host ?? "localhost"}:${config.server.port}`;
    } else {
      resource = Object.fromEntries(
        targets.map((target) => [target, getBuildResourceForTarget(target)])
      ) as { mcp?: string; openai?: string };
    }

    const manifest: ApplicationManifest = {
      format: "apollo-ai-app-manifest",
      version: "1",
      appVersion: appsConfig.version ?? packageJson.version,
      name: appsConfig.name ?? packageJson.name,
      description: appsConfig.description ?? packageJson.description,
      hash: createHash("sha256").update(Date.now().toString()).digest("hex"),
      operations: Array.from(cache.values()).flatMap(
        (entry) => entry.operations
      ),
      resource,
      csp: {
        connectDomains: appsConfig.csp?.connectDomains ?? [],
        frameDomains: appsConfig.csp?.frameDomains ?? [],
        redirectDomains: appsConfig.csp?.redirectDomains ?? [],
        resourceDomains: appsConfig.csp?.resourceDomains ?? [],
      },
    };

    if (
      appsConfig.widgetSettings &&
      isNonEmptyObject(appsConfig.widgetSettings)
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

      const widgetSettings = appsConfig.widgetSettings;

      validateWidgetSetting("prefersBorder", "boolean");
      validateWidgetSetting("description", "string");
      validateWidgetSetting("domain", "string");

      manifest.widgetSettings = widgetSettings;
    }

    if (appsConfig.labels) {
      const labels = getLabelsFromConfig(appsConfig.labels);

      if (labels) {
        manifest.labels = labels;
      }
    }

    // We create mcp and openai environments in order to write to
    // subdirectories, but we want the manifest to be in the root outDir. If we
    // are running in a different environment, we'll put it in the configured
    // outDir directly instead.
    const outDir =
      environment?.name === "mcp" || environment?.name === "openai" ?
        path.resolve(config.build.outDir, "../")
      : config.build.outDir;

    // Always write to build directory so the MCP server picks it up
    const dest = path.resolve(root, outDir, ".application-manifest.json");
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, JSON.stringify(manifest));

    // Always write to the dev location so that the app can bundle the manifest content
    fs.writeFileSync(".application-manifest.json", JSON.stringify(manifest));
  }

  return {
    name: "@apollo/client-ai-apps/vite",
    async buildStart() {
      // Read package.json on start
      packageJson = JSON.parse(fs.readFileSync("package.json", "utf-8"));

      // Scan all files on startup
      const files = await glob("./src/**/*.{ts,tsx,js,jsx}", { fs });

      for (const file of files) {
        const fullPath = path.resolve(root, file);
        await processFile(fullPath);
      }

      // We don't want to do this here on builds cause it just gets overwritten anyways. We'll call it on writeBundle instead.
      if (config.command === "serve") {
        await generateManifest(this.environment);
      }
    },
    configResolved(resolvedConfig) {
      config = resolvedConfig;
    },
    configEnvironment(name, { build }) {
      if (!targets.includes(name as any)) return;

      return {
        build: {
          outDir: path.join(build?.outDir ?? "dist", name),
        },
      };
    },
    configureServer(server) {
      server.watcher.on("change", async (file) => {
        if (file.endsWith("package.json")) {
          packageJson = JSON.parse(fs.readFileSync("package.json", "utf-8"));
          await generateManifest();
        } else if (file.match(/\.(jsx?|tsx?)$/)) {
          await processFile(file);
          await generateManifest();
        }
      });
    },

    config(_, { command }) {
      if (command === "serve") {
        invariant(
          isValidTarget(devTarget) || targets.length === 1,
          "`devTarget` must be set for development when using multiple targets."
        );

        const target = devTarget ?? targets[0];

        return {
          resolve: {
            extensions: buildExtensions(target),
            conditions: [target, ...defaultClientConditions],
          },
        };
      }

      return {
        environments: Object.fromEntries(
          targets.map((target) => [
            target,
            {
              consumer: "client",
              webCompatible: true,
              resolve: {
                extensions: buildExtensions(target),
                conditions: [target, ...defaultClientConditions],
              },
            },
          ])
        ),
        builder: {
          buildApp: async (builder) => {
            await Promise.all(
              targets.map((target) =>
                builder.build(builder.environments[target])
              )
            );
          },
        },
      };
    },
    transformIndexHtml(html, ctx) {
      if (!ctx.server) return html;

      let baseUrl = (
        ctx.server.config?.server?.origin ??
        ctx.server.resolvedUrls?.local[0] ??
        ""
      ).replace(/\/$/, "");
      baseUrl = baseUrl.replace(/\/$/, "");

      return (
        html
          // src="/src/..."
          .replace(/(src=["'])\/([^"']+)/gi, `$1${baseUrl}/$2`)
      );
    },
    async writeBundle() {
      await generateManifest(this.environment);
    },
  } satisfies Plugin;
}

const processQueryLink = new ApolloLink((operation) => {
  const body = print(
    removeManifestDirectives(sortTopLevelDefinitions(operation.query))
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

      const extraInputsNode = getDirectiveArgument("extraInputs", directive);

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
});

function getLabelsFromConfig(
  config: ApolloAiAppsConfig.Labels
): ManifestLabels | undefined {
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

function removeManifestDirectives(doc: DocumentNode) {
  return removeDirectivesFromDocument(
    [{ name: "prefetch" }, { name: "tool" }],
    doc
  )!;
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

function isNonEmptyObject(obj: object) {
  return Object.keys(obj).length > 0;
}

async function getAppsConfig(): Promise<ApolloAiAppsConfig.Config> {
  const result = await explorer.search();
  const config = (result?.config ?? {}) as Partial<ApolloAiAppsConfig.Config>;
  validateAppsConfig(config);

  return config;
}

type RequiredKeys<T> = keyof {
  [K in keyof T as Omit<T, K> extends T ? never : K]: T[K];
};

function validateAppsConfig(
  config: Partial<ApolloAiAppsConfig.Config>
): asserts config is ApolloAiAppsConfig.Config {
  // This function is a runtime no-op because we currently do not have any
  // required keys in our config, so the partial config satisfies the
  // non-partial config.
  //
  // If we add or change an existing property that is required, the following
  // variable is used to alert us. We'll see a type error when that happens to
  // ensure we add some runtime validation.
  //
  // NOTE: If we end up adding zod to validate the raw result from cosmiconfig,
  // this check should no longer be needed.
  const _requiredKeys: never = {} as RequiredKeys<ApolloAiAppsConfig.Config>;
}

function getResourceFromConfig(
  appsConfig: ApolloAiAppsConfig.Config,
  mode: string,
  target: apolloClientAiApps.Target
) {
  if (!appsConfig.entry || !appsConfig.entry[mode]) {
    return;
  }

  const config = appsConfig.entry[mode];

  return typeof config === "string" ? config : config[target];
}
