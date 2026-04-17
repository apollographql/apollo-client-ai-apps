import { test } from "@apollo/mcp-impostor-host/playwright";
import { expect } from "@playwright/test";

const URL = "http://localhost:8000/mcp?app=mock-app&appTarget=mcp";

test("omits private field in structuredContent, but available to the view", async ({
  mcpHost,
}) => {
  const connection = await mcpHost.connect({ url: URL });
  const { result, appFrame } = await connection.callTool("SemiPrivate");

  expect(result.structuredContent).toEqual({
    result: {
      data: {
        user: {
          __typename: "User",
          fullName: "MCP User",
        },
      },
    },
    toolName: "SemiPrivate",
  });

  expect(result._meta).toEqual({
    toolName: "SemiPrivate",
    structuredContent: {
      result: {
        data: {
          user: {
            __typename: "User",
            address: "1234 Main St",
            fullName: "MCP User",
          },
        },
      },
      toolName: "SemiPrivate",
    },
  });

  await expect(appFrame.getByTestId("fullName")).toHaveText("MCP User");
  await expect(appFrame.getByTestId("address")).toHaveText("1234 Main St");
});

test("omits full selection sets, but available to the view", async ({
  mcpHost,
}) => {
  const connection = await mcpHost.connect({ url: URL });
  const { result, appFrame } = await connection.callTool("Private");

  expect(result.structuredContent).toEqual({
    result: { data: {} },
    toolName: "Private",
  });

  expect(result._meta).toEqual({
    toolName: "Private",
    structuredContent: {
      result: {
        data: {
          user: {
            __typename: "User",
            address: "1234 Main St",
            fullName: "MCP User",
          },
        },
      },
      toolName: "Private",
    },
  });

  await expect(appFrame.getByTestId("fullName")).toHaveText("MCP User");
  await expect(appFrame.getByTestId("address")).toHaveText("1234 Main St");
});
