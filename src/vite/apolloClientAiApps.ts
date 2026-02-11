import { defaultClientConditions, type Plugin } from "vite";
import { invariant } from "@apollo/client/utilities/invariant";
import { ApplicationManifestPlugin } from "./application_manifest_plugin.js";
import path from "node:path";

export declare namespace apolloClientAiApps {
  export type Target = "openai" | "mcp";

  export interface Options {
    targets: Target[];
    devTarget?: Target | undefined;
  }
}

export function apolloClientAiApps(
  options: apolloClientAiApps.Options
): Plugin[] {
  return [baseApolloClientAiApps(options), ApplicationManifestPlugin(options)];
}

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

export function baseApolloClientAiApps(
  options: apolloClientAiApps.Options
): Plugin {
  const { targets: rawTargets, devTarget } = options;
  const targets = Array.from(new Set(rawTargets));

  invariant(
    Array.isArray(targets) && targets.length > 0,
    "The `targets` option must be a non-empty array"
  );

  invariant(
    targets.every(isValidTarget),
    `All targets must be one of: ${VALID_TARGETS.join(", ")}`
  );

  return {
    name: "@apollo/client-ai-apps/vite",
    configEnvironment(name, { build }) {
      if (!targets.includes(name as any)) return;

      return {
        build: {
          outDir: path.join(build?.outDir ?? "dist", name),
        },
      };
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
          // import "/@vite/..." or "/@react-refresh"
          .replace(/(from\s+["'])\/([^"']+)/g, `$1${baseUrl}/$2`)
          // src="/src/..."
          .replace(/(src=["'])\/([^"']+)/gi, `$1${baseUrl}/$2`)
      );
    },
  } satisfies Plugin;
}
