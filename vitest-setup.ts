import { beforeEach, vi } from "vitest";
import { vol, fs } from "memfs";
import mockRequire from "mock-require";
import Module from "node:module";
import path from "node:path";
import "@testing-library/jest-dom/vitest";
import "./src/testing/internal/matchers";

vi.mock("node:fs");
vi.mock("node:fs/promises");

// Intercept CJS require("fs") in externalized node_modules (cosmiconfig) since
// vitest only mocks ESM-compatible imports
mockRequire("fs", fs);
mockRequire("fs/promises", fs.promises);

// Mock import-fresh to read from memfs instead of real filesystem.
// Cosmiconfig uses import-fresh to load .js/.cjs config files via require(),
// which bypasses the mocked fs.
mockRequire("import-fresh", (filepath: string) => {
  const content = fs.readFileSync(filepath, "utf-8");
  const m = new Module(filepath);
  m.paths = (Module as any)._nodeModulePaths(path.dirname(filepath));
  (m as any)._compile(content, filepath);
  return m.exports;
});

beforeEach(() => {
  vol.reset();
});
