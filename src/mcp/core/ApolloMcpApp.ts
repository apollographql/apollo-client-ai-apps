import { App, PostMessageTransport } from "@modelcontextprotocol/ext-apps";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ApplicationManifest } from "../../types/application-manifest";
import type { ApolloMcpServerApps } from "../../core/types";
import type { FormattedExecutionResult } from "graphql";
import type { DocumentNode, OperationVariables } from "@apollo/client";
import { print } from "@apollo/client/utilities";

interface State {
  toolResult: Parameters<App["ontoolresult"]>[0] | undefined;
  toolInput: Parameters<App["ontoolinput"]>[0] | undefined;
}

type CallServerToolParams = Parameters<App["callServerTool"]>[0];
type CallServerToolOptions = Parameters<App["callServerTool"]>[1];

type ExecuteQueryCallToolResult = Omit<CallToolResult, "structuredContent"> & {
  structuredContent: FormattedExecutionResult;
};

export class ApolloMcpApp {
  readonly app: App;
  private state: State = { toolResult: undefined, toolInput: undefined };
  private handlers = new Map<keyof State, Set<(...args: any[]) => any>>();

  constructor(manifest: ApplicationManifest) {
    // TODO: Determine how we want to provide this version long-term.
    this.app = new App({ name: manifest.name, version: "1.0.0" });
    this.registerListeners();

    this.callServerTool = this.app.callServerTool.bind(this.app) as any;
  }

  get toolResult() {
    return this.state.toolResult;
  }

  get toolInput() {
    return this.state.toolInput;
  }

  connect() {
    try {
      return this.app.connect(
        new PostMessageTransport(window.parent, window.parent)
      );
    } catch (e) {
      const error = e instanceof Error ? e : new Error("Failed to connect");

      throw error;
    }
  }

  async executeQuery({
    query,
    variables,
  }: {
    query: DocumentNode;
    variables: OperationVariables | undefined;
  }) {
    const result = (await this.app.callServerTool({
      name: "execute",
      arguments: { query: print(query), variables },
    })) as ExecuteQueryCallToolResult;

    return result.structuredContent;
  }

  callServerTool(
    params: CallServerToolParams & { name: "execute" },
    options?: CallServerToolOptions
  ): Promise<
    Omit<CallToolResult, "structuredContent"> & {
      structuredContent: FormattedExecutionResult;
    }
  >;

  callServerTool(
    ...args: Parameters<App["callServerTool"]>
  ): Promise<ApolloMcpServerApps.CallToolResult>;

  callServerTool(...args: Parameters<App["callServerTool"]>): Promise<any> {
    throw new Error("Should be overri");
  }

  onChange<Key extends keyof State>(name: Key, cb: App[`on${Lowercase<Key>}`]) {
    let listeners = this.handlers.get(name);

    if (!listeners) {
      this.handlers.set(name, (listeners = new Set()));
    }

    listeners.add(cb);

    return () => {
      listeners.delete(cb);
    };
  }

  private registerListeners() {
    this.app.ontoolresult = (params) => {
      this.set("toolResult", params);
    };

    this.app.ontoolinput = (params) => {
      this.set("toolInput", params);
    };
  }

  private set<Key extends keyof State>(key: Key, value: State[Key]) {
    this.state[key] = value;
    this.notify(key);
  }

  private notify(key: keyof State) {
    this.handlers.get(key)?.forEach((listener) => listener(this.state[key]));
  }
}
