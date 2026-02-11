import type { OperationVariables } from "@apollo/client";
import {
  ApolloLink,
  ApolloClient as BaseApolloClient,
  DocumentTransform,
} from "@apollo/client";
import { removeDirectivesFromDocument } from "@apollo/client/utilities/internal";
import { parse } from "graphql";
import { __DEV__ } from "@apollo/client/utilities/environment";
import type {
  ApplicationManifest,
  ManifestOperation,
} from "../../types/application-manifest.js";
import { ToolCallLink } from "../link/ToolCallLink.js";
import {
  aiClientSymbol,
  cacheAsync,
  getVariablesForOperationFromToolInput,
} from "../../utilities/index.js";
import { McpAppManager } from "./McpAppManager.js";

export declare namespace ApolloClient {
  export interface Options extends Omit<BaseApolloClient.Options, "link"> {
    link?: BaseApolloClient.Options["link"];
    manifest: ApplicationManifest;
  }
}

export class ApolloClient extends BaseApolloClient {
  manifest: ApplicationManifest;
  private readonly appManager: McpAppManager;

  /** @internal */
  readonly [aiClientSymbol] = true;

  constructor(options: ApolloClient.Options) {
    const link = options.link ?? new ToolCallLink();

    if (__DEV__) {
      validateTerminatingLink(link);
    }

    super({
      ...options,
      link,
      // Strip out the prefetch/tool directives so they don't get sent with the operation to the server
      documentTransform: new DocumentTransform((document) => {
        return removeDirectivesFromDocument(
          [{ name: "prefetch" }, { name: "tool" }],
          document
        )!;
      }).concat(options.documentTransform ?? DocumentTransform.identity()),
    });

    this.manifest = options.manifest;
    this.appManager = new McpAppManager(this.manifest);
  }

  stop() {
    super.stop();
    this.appManager.close().catch(() => {});
  }

  waitForInitialization = cacheAsync(async () => {
    const { prefetch, result, toolName, args } =
      await this.appManager.waitForInitialization();

    this.manifest.operations.forEach((operation) => {
      if (operation.prefetchID && prefetch?.[operation.prefetchID]) {
        this.writeQuery({
          query: parse(operation.body),
          data: prefetch[operation.prefetchID].data,
        });
      }

      if (operation.tools.find((tool) => tool.name === toolName)) {
        this.writeQuery({
          query: parse(operation.body),
          data: result.data,
          variables: getVariablesForOperationFromToolInput(operation, args),
        });
      }
    });
  });
}

function validateTerminatingLink(link: ApolloLink) {
  let terminatingLink = link;

  while (terminatingLink.right) {
    terminatingLink = terminatingLink.right;
  }

  if (terminatingLink.constructor.name !== "ToolCallLink") {
    throw new Error(
      "The terminating link must be a `ToolCallLink`. If you are using a `split` link, ensure the `right` branch uses a `ToolCallLink` as the terminating link."
    );
  }
}
