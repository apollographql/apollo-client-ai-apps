import type { ApolloClient as BaseApolloClient } from "@apollo/client";
import type { ApplicationManifest } from "../types/application-manifest.js";
import { aiClientSymbol } from "../utilities/constants.js";

export declare namespace ApolloClient {
  export interface Options extends Omit<BaseApolloClient.Options, "link"> {
    link?: BaseApolloClient.Options["link"];
    manifest: ApplicationManifest;
  }
}

export class ApolloClient {
  /**
   * @internal
   * @deprecated For internal use. Do not use directly.
   */
  readonly info = aiClientSymbol;

  constructor(options: ApolloClient.Options) {
    throw new Error(
      "Cannot construct an `ApolloClient` instance from `@apollo/client-ai-apps` without export conditions. Please set conditions or import from the `/openai` or `/mcp` subpath directly."
    );
  }

  async waitForInitialization() {}
}
