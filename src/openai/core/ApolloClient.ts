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

      app.ontoolresult = (params) => {
        toolResult.resolve(
          params as unknown as ApolloMcpServerApps.CallToolResult
        );
      };

      await connectToHost(app);

      // After a page refresh, OpenAI does not re-send `ui/notifications/tool-result`.
      // Instead, the tool result is available immediately via `window.openai.toolOutput`.
      // If it's already set, resolve the promise now rather than waiting for the
      // notification that will never arrive.
      if (window.openai.toolOutput !== null) {
        toolResult.resolve({
          structuredContent: window.openai.toolOutput,
          content: [],
        });
      }

      const { structuredContent } = await toolResult.promise;

      return {
        structuredContent,
        // OpenAI is not consistent about sending `ui/notifications/tool-input`.
        // Sometimes it doesn't send at all, other times it sends more than once
        // before we get the tool result (which should always happen and at most
        // once according to the spec). Rather than relying on the
        // `ui/notifications/tool-input` notification to set the tool input value,
        // we read from `window.openai.toolInput so that we have the most recent
        // set value.
        //
        // When OpenAI fixes this issue and sends `ui/notifications/tool-input`
        // consistently according to the MCP Apps specification, this can be
        // reverted to use the `app.ontoolinput` callback.
        toolInput: window.openai.toolInput,

        // OpenAI doesn't provide access to `_meta` from ui/notifications/tool-result,
        // so we need to use window.openai.toolResponseMetadata directly
        _meta: window.openai.toolResponseMetadata as
          | ApolloMcpServerApps.Meta
          | undefined,
      };
    });
  }
}
