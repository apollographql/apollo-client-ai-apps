export type ApplicationManifest = {
  format: "apollo-ai-app-manifest";
  version: "1";
  name: string;
  description: string;
  hash: string;
  resource: string;
  operations: ManifestOperation[];
  csp: ManifestCsp;
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
