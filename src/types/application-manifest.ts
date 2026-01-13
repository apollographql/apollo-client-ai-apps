export type ApplicationManifest = {
  format: "apollo-ai-app-manifest";
  version: "1";
  name: string;
  description: string;
  hash: string;
  resource: string;
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
  connectDomains: string[];
  resourceDomains: string[];
};

export type ManifestLabels = {
  "toolInvocation/invoking"?: string;
  "toolInvocation/invoked"?: string;
};
