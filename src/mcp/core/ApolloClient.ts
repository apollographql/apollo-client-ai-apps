import { __DEV__ } from "@apollo/client/utilities/environment";
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
      let toolResult =
        promiseWithResolvers<ApolloMcpServerApps.CallToolResult>();
      let toolInput = promiseWithResolvers<Parameters<App["ontoolinput"]>[0]>();

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

      // Some hosts do not provide toolInfo in the ui/initialize response, so we
      // fallback to `_meta.toolName` provided by Apollo MCP server if the value
      // is not available.
      const toolName =
        app.getHostContext()?.toolInfo?.tool.name ??
        _meta?.toolName ??
        // Some hosts do not forward `_meta` nor do they provide `toolInfo`. Our
        // MCP server provides `toolName` in `structuredContent` as a workaround
        // that we can use if all else fails
        structuredContent.toolName;

      return {
        structuredContent,
        toolName,
        toolInput: args,
        _meta,
      };
    });
  }
}
