export const sharedConfig = {
  entryPoints: ["src/index.ts"],
  bundle: true,
  outdir: "dist",
  platform: "browser",
  format: "esm",
  packages: "external",
  external: ["react", "react-dom"],
};
