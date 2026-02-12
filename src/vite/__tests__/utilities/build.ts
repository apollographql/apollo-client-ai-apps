import fs from "node:fs";
import path from "node:path";
import { build, createServer, type InlineConfig } from "vite";

type Plugins = NonNullable<InlineConfig["plugins"]>;

export async function setupServer(config: InlineConfig & { plugins: Plugins }) {
  const server = await createServer({
    configFile: false,
    server: {
      port: 3333,
      ...config.server,
    },
    ...config,
  });

  return {
    ...server,
    [Symbol.asyncDispose]() {
      return server.close();
    },
  };
}

export async function buildApp(
  config: Omit<InlineConfig, "configFile" | "plugins"> & {
    plugins: Plugins;
  }
) {
  await build({
    configFile: false,
    logLevel: "silent",
    ...config,
    build: {
      emptyOutDir: false,
      outDir: "dist",
      ...config.build,
      rollupOptions: {
        input: config.build?.rollupOptions?.input ?? "virtual:entry",
      },
    },
    plugins: [
      ...config.plugins,

      // We need to use `fs` to resolve modules to ensure vite uses memfs when
      // building, otherwise we get an ENOENT error for any files written to the
      // virtual filesystem.
      {
        name: "test:virtual-entry",
        resolveId(id) {
          if (id === "virtual:entry") return id;
          if (id.endsWith(".html")) return path.resolve(id);

          if (id.startsWith("/")) {
            const resolved = path.resolve(id.slice(1));

            if (fs.existsSync(resolved)) {
              return resolved;
            }
          }
        },
        load(id) {
          if (id === "virtual:entry") return "export default {};";

          if (fs.existsSync(id)) {
            return fs.readFileSync(id, "utf8");
          }
        },
      },
    ],
  });
}
