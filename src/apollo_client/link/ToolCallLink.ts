import { ApolloLink, Observable } from "@apollo/client";
import { from, map } from "rxjs";
import {
  fallbackHttpConfig,
  selectHttpOptionsAndBody,
} from "@apollo/client/link/http";

export class ToolCallLink extends ApolloLink {
  request(operation: ApolloLink.Operation): Observable<ApolloLink.Result> {
    const context = operation.getContext();
    const contextConfig = {
      http: context.http,
      options: context.fetchOptions,
      credentials: context.credentials,
      headers: context.headers,
    };
    const { query, variables } = selectHttpOptionsAndBody(
      operation,
      fallbackHttpConfig,
      contextConfig,
    ).body;

    return from(window.openai.callTool("execute", { query, variables })).pipe(
      map((result) => ({ data: result.structuredContent.data })),
    );
  }
}
