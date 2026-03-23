export type ApplicationManifest = {
  format: "apollo-ai-app-manifest";
  version: "1";
  appVersion: string;
  name: string;
  description: string;
  hash: string;
  resource:
    | string
    | {
        mcp?: string;
        openai?: string;
      };
  operations: ManifestOperation[];
  csp: ManifestCsp;
  widgetSettings?: ManifestWidgetSettings;
  labels?: ManifestLabels;
};

export type ManifestOperation = {
  id: string;
  name: string;
  type: "query" | "mutation";
  body: string;
  variables?: Record<string, string | undefined>;
  prefetch: boolean;
  prefetchID?: string;
  tools: ManifestTool[];
};

export type ManifestTool = {
  name: string;
  description: string;
  extraInputs?: ManifestExtraInput[];
  extraOutputs?: Record<string, unknown>;
  labels?: ManifestLabels;
};

export type ManifestWidgetSettings = {
  description?: string;
  domain?: string;
  prefersBorder?: boolean;
};

export type ManifestExtraInput = {
  name: string;
  description: string;
  type: "string" | "boolean" | "number";
};

export type ManifestCsp = {
  baseUriDomains: string[];
  connectDomains: string[];
  frameDomains: string[];
  redirectDomains: string[];
  resourceDomains: string[];
};

export type ManifestLabels = {
  "toolInvocation/invoking"?: string;
  "toolInvocation/invoked"?: string;
};
