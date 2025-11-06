import * as esbuild from "esbuild";
import { sharedConfig } from "./shared.mjs";

// Build react components
await esbuild.build({
  ...sharedConfig,
});
