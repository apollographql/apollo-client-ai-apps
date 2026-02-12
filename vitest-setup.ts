import { beforeEach, vi } from "vitest";
import { vol } from "memfs";
import "@testing-library/jest-dom/vitest";
import "./src/testing/internal/matchers";

vi.mock("node:fs");
vi.mock("node:fs/promises");

beforeEach(() => {
  vol.reset();
});
