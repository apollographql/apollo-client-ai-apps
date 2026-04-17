import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
import { apolloClientAiApps } from "@apollo/client-ai-apps/vite";

export default defineConfig({
  build: {
    emptyOutDir: true,
  },
  resolve: {
    dedupe: ["react", "react-dom", "@apollo/client"],
  },
  plugins: [
    apolloClientAiApps({
      targets: ["mcp"],
      appsOutDir: "../apps",
      schema: "../schema.graphql",
    }),
    react(),
    viteSingleFile(),
  ],
});
