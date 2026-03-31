import { AbstractApolloClient } from "./AbstractApolloClient.js";
import { aiClientSymbol } from "../utilities/constants.js";

export declare namespace ApolloClient {
  export interface Options extends AbstractApolloClient.Options {}
}

export class ApolloClient extends AbstractApolloClient {
  /** @internal */
  readonly [aiClientSymbol] = true;

  constructor(options: ApolloClient.Options) {
    super(options as any, () => {
      throw new Error(
        "Cannot connect an `ApolloClient` instance from `@apollo/client-ai-apps` without export conditions. Please set conditions or import from the `/openai` or `/mcp` subpath directly."
      );
    });

    throw new Error(
      "Cannot construct an `ApolloClient` instance from `@apollo/client-ai-apps` without export conditions. Please set conditions or import from the `/openai` or `/mcp` subpath directly."
    );
  }
}
