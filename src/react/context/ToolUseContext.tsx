import React, { createContext, ReactNode, useContext, useState } from "react";

interface ToolUseState {
  appName: string;
  hasNavigated: boolean;
  setHasNavigated: (v: boolean) => void;
}

const ToolUseContext = createContext<ToolUseState | null>(null);

export declare namespace ToolUseProvider {
  export interface Props {
    children?: ReactNode;
    appName: string;
  }
}

export function ToolUseProvider({ children, appName }: ToolUseProvider.Props) {
  const [hasNavigated, setHasNavigated] = useState(false);

  return (
    <ToolUseContext.Provider value={{ hasNavigated, setHasNavigated, appName }}>
      {children}
    </ToolUseContext.Provider>
  );
}

export function useToolUseState() {
  return useContext(ToolUseContext);
}
