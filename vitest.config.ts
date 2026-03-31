import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "happy-dom",
    setupFiles: ["./vitest-setup.ts"],
    mockReset: true,
    unstubGlobals: true,
    tags: [
      {
        name: "flaky",
        retry: 3,
        description:
          "Tests that might intermittently fail due to e.g. timeout issues.",
      },
      {
        name: "fs",
        timeout: 10_000,
        description: "Tests that write to the filesystem.",
      },
    ],
  },
});
