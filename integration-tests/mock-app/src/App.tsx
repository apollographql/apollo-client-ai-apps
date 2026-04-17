import { useToolInfo } from "@apollo/client-ai-apps/react";
import { Hello } from "./tools/Hello";
import { Echo } from "./tools/Echo";
import { Private } from "./tools/Private";
import { SemiPrivate } from "./tools/SemiPrivate";

export function App() {
  const toolInfo = useToolInfo();

  switch (toolInfo?.toolName) {
    case "Hello":
      return <Hello />;
    case "Echo":
      return <Echo />;
    case "Private":
      return <Private />;
    case "SemiPrivate":
      return <SemiPrivate />;
    default:
      // @ts-expect-error type should be never
      throw new Error(`Unknown tool: ${toolInfo?.toolName}`);
  }
}
