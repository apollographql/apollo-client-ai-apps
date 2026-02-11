import {
  LATEST_PROTOCOL_VERSION,
  type McpUiHostCapabilities,
  type McpUiHostContext,
  type McpUiToolResultNotification,
  type McpUiToolInputNotification,
} from "@modelcontextprotocol/ext-apps";
import type {
  CallToolRequest,
  CallToolResult,
  Implementation,
} from "@modelcontextprotocol/sdk/types.js";
import { invariant, promiseWithResolvers } from "../../../utilities/index.js";

export interface MockMcpHost extends Disposable {
  sendToolResult(params: McpUiToolResultNotification["params"]): Promise<void>;
  sendToolInput(params: McpUiToolInputNotification["params"]): Promise<void>;
  mockToolCall(
    name: string,
    handler: (params: CallToolRequest["params"]) => CallToolResult
  ): () => void;
  /**
   * Register an MCP App to be closed during cleanup. This prevents the App's
   * transport from interfering with subsequent tests by responding to messages
   * it shouldn't be handling.
   */
  onCleanup(cleanup: () => void): void;
  cleanup(): void;
}

/**
 * In vitest's happy-dom environment, `window` is a Proxy around the real
 * `GlobalWindow` object. `event.source` on `MessageEvent` returns the real
 * `GlobalWindow`, which !== the proxied `window`. `PostMessageTransport` uses
 * `event.source !== eventSource` to validate messages, so all messages get
 * rejected when `eventSource` is the proxy.
 *
 * We work around this by discovering the real `GlobalWindow` via a probe
 * `postMessage` and overriding `window.parent` so `PostMessageTransport`
 * (which is constructed with `window.parent` as both target and eventSource)
 * can properly match `event.source`.
 */
async function patchWindowParent(): Promise<() => void> {
  const realWindow = await new Promise<Window>((resolve) => {
    const probe = (event: MessageEvent) => {
      window.removeEventListener("message", probe);
      resolve(event.source as Window);
    };
    window.addEventListener("message", probe);
    window.postMessage({ __mockMcpHostProbe: true }, "*");
  });

  // If event.source already matches window.parent, no patch needed
  if (realWindow === window.parent) {
    return () => {};
  }

  const originalParent = window.parent;
  Object.defineProperty(window, "parent", {
    value: realWindow,
    writable: true,
    configurable: true,
  });

  return () => {
    Object.defineProperty(window, "parent", {
      value: originalParent,
      writable: true,
      configurable: true,
    });
  };
}

export declare namespace mockMcpHost {
  export interface Options {
    hostCapabilities?: McpUiHostCapabilities;
    hostContext?: McpUiHostContext;
    hostInfo?: Implementation;
  }
}

export async function mockMcpHost(
  options?: mockMcpHost.Options
): Promise<MockMcpHost> {
  const {
    hostCapabilities = {},
    hostContext = {},
    hostInfo = { name: "MockMcpHost", version: "1.0.0" },
  } = options ?? {};

  const restore = await patchWindowParent();

  const { promise: initialized, resolve: resolveInitialized } =
    promiseWithResolvers<void>();

  const cleanupFns = new Set<() => void>();
  const toolCallHandlers = new Map<
    string,
    (params: CallToolRequest["params"]) => CallToolResult
  >();

  const listener = (event: MessageEvent<unknown>) => {
    const data = event.data;

    if (!data || typeof data !== "object" || !("jsonrpc" in data)) return;
    if (!("method" in data)) return;

    if (data.method === "ui/initialize" && "id" in data) {
      window.postMessage({
        jsonrpc: "2.0",
        id: data.id,
        result: {
          protocolVersion: LATEST_PROTOCOL_VERSION,
          hostCapabilities,
          hostInfo,
          hostContext,
        },
      });
    }

    // The App sends this notification after processing the initialize response
    if (data.method === "ui/notifications/initialized") {
      resolveInitialized();
    }

    if (data.method === "tools/call" && "id" in data) {
      const { params } = data as unknown as CallToolRequest;

      const handler = toolCallHandlers.get(params.name);

      invariant(
        handler,
        `mockMcpHost: A mock tool call handler for '${params.name}' is not registered.`
      );

      window.postMessage({
        jsonrpc: "2.0",
        id: data.id,
        result: handler(params),
      });
    }
  };

  window.addEventListener("message", listener);

  function cleanup() {
    window.removeEventListener("message", listener);
    cleanupFns.forEach((fn) => fn());
    restore();
  }

  return {
    async sendToolResult(params) {
      await initialized;
      window.postMessage({
        jsonrpc: "2.0",
        method: "ui/notifications/tool-result",
        params,
      });
    },
    async sendToolInput(params) {
      await initialized;
      window.postMessage({
        jsonrpc: "2.0",
        method: "ui/notifications/tool-input",
        params,
      });
    },
    mockToolCall(name, handler) {
      if (toolCallHandlers.has(name)) {
        console.warn(
          `mockMcpHost: a handler is already registered for tool "${name}"`
        );
      }

      toolCallHandlers.set(name, handler);

      return () => toolCallHandlers.delete(name);
    },
    onCleanup(fn) {
      cleanupFns.add(fn);
    },
    cleanup,
    [Symbol.dispose]() {
      cleanup();
    },
  } satisfies MockMcpHost;
}
