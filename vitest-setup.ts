import { beforeEach, vi } from "vitest";
import { vol, fs } from "memfs";
import mockRequire from "mock-require";
import "@testing-library/jest-dom/vitest";
import "./src/testing/internal/matchers";

vi.mock("node:fs");
vi.mock("node:fs/promises");

// Intercept CJS require("fs") in externalized node_modules (cosmiconfig) since
// vitest only mocks ESM-compatible imports
mockRequire("fs", fs);
mockRequire("fs/promises", fs.promises);

beforeEach(() => {
  vol.reset();
});
