import type { ApplicationManifest } from "../../../types/application-manifest";

export function mockApplicationManifest(
  overrides?: Partial<ApplicationManifest>
): ApplicationManifest {
  return {
    format: "apollo-ai-app-manifest",
    version: "1",
    name: "the-store",
    description:
      "An online store selling a variety of high quality products across many different categories.",
    hash: "f6a24922f6ad6ed8c2aa57baf3b8242ae5f38a09a6df3f2693077732434c4256",
    operations: [
      {
        id: "c43af26552874026c3fb346148c5795896aa2f3a872410a0a2621cffee25291c",
        name: "Product",
        type: "query",
        body: "query Product($id: ID!) {\n  product(id: $id) {\n    id\n    title\n    rating\n    price\n    description\n    images\n    __typename\n  }\n}",
        variables: { id: "ID" },
        prefetch: false,
        tools: [
          {
            name: "Get Product",
            description: "Shows the details page for a specific product.",
          },
        ],
      },
    ],
    resource: "index.html",
    csp: {
      resourceDomains: [],
      connectDomains: [],
      frameDomains: [],
      redirectDomains: [],
    },
    ...overrides,
  };
}
