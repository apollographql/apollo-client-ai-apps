export type {
  ApplicationManifest,
  ManifestOperation,
  ManifestTool,
  ManifestExtraInput,
  ManifestCsp,
  ManifestLabels,
  ManifestWidgetSettings,
} from "./types/application-manifest.js";

export class ApolloClient {
  constructor() {
    throw new Error(
      "Cannot construct an `ApolloClient` instance from `@apollo/client-ai-apps` without export conditions. Please set conditions or import from the `/openai` or `/mcp` subpath directly."
    );
  }
}
