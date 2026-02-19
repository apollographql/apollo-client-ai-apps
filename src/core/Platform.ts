import { __DEV__ } from "@apollo/client/utilities/environment";

let warned = false;

export const Platform = Object.freeze({
  get target() {
    if (__DEV__) {
      if (!warned) {
        console.error(
          "Could not determine the platform target because module conditions are not properly configured for either the `mcp` or `openai` environment. Please ensure you are using the `apolloClientAiApps` vite plugin."
        );
        warned = true;
      }
    }

    // Even though this return the "unknown" string, this value should never
    // actually be seen at runtime unless something is misconfigured, hence the
    // type cast to the other values.
    return "unknown" as unknown as "mcp" | "openai";
  },
  select<
    T = unknown,
    TReturn = T extends (...args: any[]) => infer TReturn ? TReturn : T,
  >(config: { mcp?: T; openai?: T }): TReturn | undefined {
    return;
  },
});
