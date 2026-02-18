import React, { useEffect } from "react";
import { useToolName } from "./useToolName.js";
import { useToolUseState } from "../../../react/ToolUseContext.js";

export const useToolEffect = (
  toolName: string | string[],
  effect: (toolInput: any) => void,
  deps: React.DependencyList = []
) => {
  const ctx = useToolUseState();
  const fullToolName = useToolName();
  if (!ctx)
    throw new Error("useToolEffect must be used within ToolUseProvider");

  const toolNames = Array.isArray(toolName) ? toolName : [toolName];

  useEffect(() => {
    const matches = toolNames.some((name) => fullToolName === name);

    if (!ctx.hasNavigated && matches) {
      effect(window.openai.toolInput);
      ctx.setHasNavigated(true);
    }
  }, [ctx.hasNavigated, ctx.setHasNavigated, toolNames, fullToolName, ...deps]);
};
