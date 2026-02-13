import type { ApolloClientAiAppsConfig } from "./types.js";

/**
 * Helper type that makes it easier to define app configuration
 */
export function defineConfig(config: ApolloClientAiAppsConfig.Config) {
  return config;
}
