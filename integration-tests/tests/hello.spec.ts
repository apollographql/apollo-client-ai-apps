import { test } from "@apollo/mcp-impostor-host/playwright";
import { expect } from "@playwright/test";

const URL = "http://localhost:8000/mcp?app=mock-app&appTarget=mcp";

test("renders data from a tool with no arguments", async ({ mcpHost }) => {
  const connection = await mcpHost.connect({ url: URL });
  const { appFrame } = await connection.callTool("Hello");

  await expect(appFrame.getByTestId("greeting")).toHaveText("Hello, world!");
});
