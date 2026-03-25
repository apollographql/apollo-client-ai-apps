import type { App } from "@modelcontextprotocol/ext-apps";
import { AbstractApolloClient } from "../../core/AbstractApolloClient.js";
import { connectToHost, promiseWithResolvers } from "../../utilities/index.js";
import type { ApolloMcpServerApps } from "../../core/types.js";

export declare namespace ApolloClient {
  export interface Options extends AbstractApolloClient.Options {}
}

export class ApolloClient extends AbstractApolloClient {
  constructor(options: ApolloClient.Options) {
    super(options, async (app) => {
      const toolResult =
        promiseWithResolvers<ApolloMcpServerApps.CallToolResult>();
      const toolInput =
        promiseWithResolvers<Parameters<App["ontoolinput"]>[0]>();

      app.ontoolresult = (params) => {
        toolResult.resolve(
          params as unknown as ApolloMcpServerApps.CallToolResult
        );
      };

      app.ontoolinput = (params) => {
        toolInput.resolve(params);
      };

      await connectToHost(app);

      const { structuredContent, _meta } = await toolResult.promise;
      const { arguments: args } = await toolInput.promise;

      return {
        structuredContent,
        toolInput: args,
        _meta,
      };
    });
  }
}
