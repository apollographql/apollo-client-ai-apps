import { expect, test, vi } from "vitest";
import { useToolEffect } from "../useToolEffect";
import { renderHook } from "@testing-library/react";
import { ToolUseProvider } from "../../context/ToolUseContext";

test("Should trigger effect when tool name matches toolResponseMetadata", async () => {
  vi.stubGlobal("openai", {
    toolResponseMetadata: { toolName: "my-app--my-tool" },
  });
  const navigate = vi.fn();
  const wrapper = ({ children }: { children: any }) => (
    <ToolUseProvider appName="my-app">{children}</ToolUseProvider>
  );

  renderHook(() => useToolEffect("my-tool", () => navigate(), [navigate]), {
    wrapper,
  });

  expect(navigate).toBeCalled();
});

test("Should trigger effect when one of multiple tool name matches toolResponseMetadata", async () => {
  vi.stubGlobal("openai", {
    toolResponseMetadata: { toolName: "my-app--my-tool" },
  });
  const navigate = vi.fn();
  const wrapper = ({ children }: { children: any }) => (
    <ToolUseProvider appName="my-app">{children}</ToolUseProvider>
  );

  renderHook(
    () =>
      useToolEffect(["my-tool", "my-similar-tool"], () => navigate(), [
        navigate,
      ]),
    { wrapper }
  );

  expect(navigate).toBeCalled();
});

test("Should not trigger effect when tool name does not match toolResponseMetadata", async () => {
  vi.stubGlobal("openai", {
    toolResponseMetadata: { toolName: "my-app--my-other-tool" },
  });
  const navigate = vi.fn();
  const wrapper = ({ children }: { children: any }) => (
    <ToolUseProvider appName="my-app">{children}</ToolUseProvider>
  );

  renderHook(() => useToolEffect("my-tool", () => navigate(), [navigate]), {
    wrapper,
  });

  expect(navigate).not.toBeCalled();
});

test("Should throw an error when used outside of a ToolUseProvider", async () => {
  vi.stubGlobal("openai", {
    toolResponseMetadata: { toolName: "my-app--my-other-tool" },
  });
  const navigate = vi.fn();

  expect(() =>
    renderHook(() => useToolEffect("my-tool", () => navigate(), [navigate]))
  ).toThrowError("useToolEffect must be used within ToolUseProvider");
});
