import { expect, test, vi } from "vitest";
import { useCallTool } from "./useCallTool";

test("Should execute tool when returned function is called", async () => {
  vi.stubGlobal("openai", {
    callTool: vi.fn(async (name: string, args: Record<string, unknown>) => {
      return {
        structuredContent: {
          data: {
            product: {
              id: "1",
              title: "Pen",
              rating: 5,
              price: 1.0,
              description: "Awesome pen",
              images: [],
              __typename: "Product",
            },
          },
        },
      };
    }),
  });

  const callTool = useCallTool();
  const result = await callTool("my-tool", { id: 1 });

  expect(window.openai.callTool).toBeCalledWith("my-tool", { id: 1 });
  expect(result).toMatchInlineSnapshot(`
    {
      "structuredContent": {
        "data": {
          "product": {
            "__typename": "Product",
            "description": "Awesome pen",
            "id": "1",
            "images": [],
            "price": 1,
            "rating": 5,
            "title": "Pen",
          },
        },
      },
    }
  `);
});
