import type { ReactNode } from "react";
import { createContext, useContext, useState } from "react";

interface ToolUseState {
  hasNavigated: boolean;
  setHasNavigated: (v: boolean) => void;
}

const ToolUseContext = createContext<ToolUseState | null>(null);

export declare namespace ToolUseProvider {
  export interface Props {
    children?: ReactNode;
  }
}

export function ToolUseProvider({ children }: ToolUseProvider.Props) {
  const [hasNavigated, setHasNavigated] = useState(false);

  return (
    <ToolUseContext.Provider value={{ hasNavigated, setHasNavigated }}>
      {children}
    </ToolUseContext.Provider>
  );
}

export function useToolUseState() {
  return useContext(ToolUseContext);
}
