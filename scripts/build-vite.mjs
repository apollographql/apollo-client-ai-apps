import * as esbuild from "esbuild";

// Separately build Vite plugin
await esbuild.build({
  entryPoints: ["src/vite/index.ts"],
  bundle: true,
  outdir: "dist/vite",
  platform: "node",
  format: "esm",
  external: [
    "glob",
    "@graphql-tools/graphql-tag-pluck",
    "@graphql-tools/graphql-tag-pluck",
    "graphql",
    "@apollo/client",
    "rxjs",
  ],
});
