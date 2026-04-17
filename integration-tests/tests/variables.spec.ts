import { test } from "@apollo/mcp-impostor-host/playwright";
import { expect } from "@playwright/test";

const URL = "http://localhost:8000/mcp?app=mock-app&appTarget=mcp";

test("renders data from a tool with arguments", async ({ mcpHost }) => {
  const connection = await mcpHost.connect({ url: URL });
  const { result, appFrame } = await connection.callTool("Echo", {
    message: "Hello!",
  });

  expect(result.structuredContent).toStrictEqual({
    toolName: "Echo",
    result: {
      data: {
        echo: "Hello! (Hello!)",
      },
    },
  });
  expect(result._meta).toStrictEqual({
    toolName: "Echo",
  });
  await expect(appFrame.getByTestId("echo")).toHaveText("Hello! (Hello!)");
});
