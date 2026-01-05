import React, { useEffect, useState } from "react";
import { useToolName } from "./useToolName";
import { useToolInput } from "./useToolInput";

type ToolUseState = {
  appName: string;
  hasNavigated: boolean;
  setHasNavigated: (v: boolean) => void;
};

const ToolUseContext = React.createContext<ToolUseState | null>(null);

export function ToolUseProvider({
  children,
  appName,
}: {
  children: any;
  appName: string;
}) {
  const [hasNavigated, setHasNavigated] = useState(false);

  return (
    <ToolUseContext.Provider value={{ hasNavigated, setHasNavigated, appName }}>
      {children}
    </ToolUseContext.Provider>
  );
}

export const useToolEffect = (
  toolName: string | string[],
  effect: (toolInput: any) => void,
  deps: React.DependencyList = []
) => {
  const ctx = React.useContext(ToolUseContext);
  const fullToolName = useToolName();
  const toolInput = useToolInput();
  if (!ctx)
    throw new Error("useToolEffect must be used within ToolUseProvider");

  const toolNames = Array.isArray(toolName) ? toolName : [toolName];

  useEffect(() => {
    const matches = toolNames.some(
      (name) => fullToolName === `${ctx.appName}--${name}`
    );

    if (!ctx.hasNavigated && matches) {
      effect(toolInput);
      ctx.setHasNavigated(true);
    }
  }, [
    ctx.hasNavigated,
    ctx.setHasNavigated,
    ctx.appName,
    toolNames,
    fullToolName,
    toolInput,
    ...deps,
  ]);
};
