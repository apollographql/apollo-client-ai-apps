import { beforeEach, describe, expect, test, vi } from "vitest";
import { spyOnConsole, wait } from "../../testing/internal/index.js";
import fs from "node:fs";
import { gql, type DocumentNode } from "@apollo/client";
import { getMainDefinition, print } from "@apollo/client/utilities";
import { getOperationName } from "@apollo/client/utilities/internal";
import { vol } from "memfs";
import { apolloClientAiApps } from "../apolloClientAiApps.js";
import { buildApp, setupServer } from "./utilities/build.js";
import type { ApplicationManifest } from "../../types/application-manifest.js";
import { explorer } from "../utilities/config.js";
import { invariant } from "@apollo/client/utilities/invariant";
import { Kind } from "graphql";
import type { ApolloClientAiAppsConfig } from "../../config/types.js";

beforeEach(() => {
  explorer.clearCaches();
});

describe("operations", () => {
  test("writes to dev application manifest file when using a serve command", async () => {
    vol.fromJSON({
      "package.json": mockPackageJson({
        "apollo-client-ai-apps": {
          labels: {
            toolInvocation: {
              invoking: "Testing global...",
              invoked: "Tested global!",
            },
          },
          csp: {
            baseUriDomains: ["https://base.example.com"],
            connectDomains: ["https://connect.example.com"],
            frameDomains: ["https://frame.example.com"],
            redirectDomains: ["https://redirect.example.com"],
            resourceDomains: ["https://resource.example.com"],
          },
          widgetSettings: {
            description: "Test",
            domain: "https://example.com",
            prefersBorder: true,
          },
        } satisfies ApolloClientAiAppsConfig.Config,
      }),
      "src/my-component.tsx": declareOperation(gql`
        query HelloWorldQuery($name: string!)
        @tool(
          name: "hello-world"
          description: "This is an awesome tool!"
          extraInputs: [
            {
              name: "doStuff"
              type: "boolean"
              description: "Should we do stuff?"
            }
          ]
          labels: {
            toolInvocation: {
              invoking: "Testing tool..."
              invoked: "Tested tool!"
            }
          }
        ) {
          helloWorld(name: $name)
        }
      `),
    });

    await using server = await setupServer({
      plugins: [
        apolloClientAiApps({ targets: ["mcp"], appsOutDir: "dist/apps" }),
      ],
    });
    await server.listen();

    const manifest = readManifestFile();
    expect(manifest).toMatchInlineSnapshot(`
      {
        "appVersion": "1.0.0",
        "csp": {
          "baseUriDomains": [
            "https://base.example.com",
          ],
          "connectDomains": [
            "https://connect.example.com",
          ],
          "frameDomains": [
            "https://frame.example.com",
          ],
          "redirectDomains": [
            "https://redirect.example.com",
          ],
          "resourceDomains": [
            "https://resource.example.com",
          ],
        },
        "format": "apollo-ai-app-manifest",
        "hash": "abc",
        "labels": {
          "toolInvocation/invoked": "Tested global!",
          "toolInvocation/invoking": "Testing global...",
        },
        "name": "my-app",
        "operations": [
          {
            "body": "query HelloWorldQuery($name: string!) {
        helloWorld(name: $name)
      }",
            "id": "c2ceb00338549909d9a8cd5cc601bda78d8c27654294dfe408a6c3735beb26a6",
            "name": "HelloWorldQuery",
            "prefetch": false,
            "tools": [
              {
                "description": "This is an awesome tool!",
                "extraInputs": [
                  {
                    "description": "Should we do stuff?",
                    "name": "doStuff",
                    "type": "boolean",
                  },
                ],
                "labels": {
                  "toolInvocation/invoked": "Tested tool!",
                  "toolInvocation/invoking": "Testing tool...",
                },
                "name": "hello-world",
              },
            ],
            "type": "query",
            "variables": {
              "name": "string",
            },
          },
        ],
        "resource": "http://localhost:3333",
        "version": "1",
        "widgetSettings": {
          "description": "Test",
          "domain": "https://example.com",
          "prefersBorder": true,
        },
      }
    `);
  });

  test("handles operations with fragments in the same file", async () => {
    vol.fromJSON({
      "package.json": mockPackageJson(),
      "src/my-component.tsx": declareOperation(gql`
        query HelloWorldQuery($name: string!)
        @tool(name: "hello-world", description: "This is an awesome tool!") {
          greeting {
            message
            recipient {
              ...RecipientFragment
            }
          }
        }

        fragment RecipientFragment on Recipient {
          id
          name
        }
      `),
    });

    await using server = await setupServer({
      plugins: [
        apolloClientAiApps({ targets: ["mcp"], appsOutDir: "dist/apps" }),
      ],
    });
    await server.listen();

    const manifest = readManifestFile();
    expect(manifest).toMatchInlineSnapshot(`
      {
        "appVersion": "1.0.0",
        "csp": {
          "baseUriDomains": [],
          "connectDomains": [],
          "frameDomains": [],
          "redirectDomains": [],
          "resourceDomains": [],
        },
        "format": "apollo-ai-app-manifest",
        "hash": "abc",
        "name": "my-app",
        "operations": [
          {
            "body": "query HelloWorldQuery {
        greeting {
          message
          recipient {
            ...RecipientFragment
            __typename
          }
          __typename
        }
      }

      fragment RecipientFragment on Recipient {
        id
        name
        __typename
      }",
            "id": "1646a86ae2ff5ad75457161be5cff80f3ba5172da573a0fc796b268870119020",
            "name": "HelloWorldQuery",
            "prefetch": false,
            "tools": [
              {
                "description": "This is an awesome tool!",
                "name": "hello-world",
              },
            ],
            "type": "query",
            "variables": {
              "name": "string",
            },
          },
        ],
        "resource": "http://localhost:3333",
        "version": "1",
      }
    `);
  });

  test("handles operations with fragments in other files", async () => {
    vol.fromJSON({
      "package.json": mockPackageJson(),
      "src/first-recipient.tsx": declareFragment(gql`
        fragment OtherRecipientFragment on Recipient {
          name
        }
      `),
      "src/my-component.tsx": declareOperation(gql`
        query HelloWorldQuery($name: string!)
        @tool(name: "hello-world", description: "This is an awesome tool!") {
          greeting {
            message
            recipient {
              ...RecipientFragment
              ...OtherRecipientFragment
            }
          }
        }
      `),
      "src/my-fragment.tsx": declareFragment(gql`
        fragment RecipientFragment on Recipient {
          id
          name
        }
      `),
    });

    await using server = await setupServer({
      plugins: [
        apolloClientAiApps({ targets: ["mcp"], appsOutDir: "dist/apps" }),
      ],
    });
    await server.listen();

    const manifest = readManifestFile();
    expect(manifest).toMatchInlineSnapshot(`
      {
        "appVersion": "1.0.0",
        "csp": {
          "baseUriDomains": [],
          "connectDomains": [],
          "frameDomains": [],
          "redirectDomains": [],
          "resourceDomains": [],
        },
        "format": "apollo-ai-app-manifest",
        "hash": "abc",
        "name": "my-app",
        "operations": [
          {
            "body": "query HelloWorldQuery {
        greeting {
          message
          recipient {
            ...RecipientFragment
            ...OtherRecipientFragment
            __typename
          }
          __typename
        }
      }

      fragment OtherRecipientFragment on Recipient {
        name
        __typename
      }

      fragment RecipientFragment on Recipient {
        id
        name
        __typename
      }",
            "id": "c65cb5ec2dc76bbfa992cd2a98c05ab3f909349f3f1478e608a7f16ae29bdd4a",
            "name": "HelloWorldQuery",
            "prefetch": false,
            "tools": [
              {
                "description": "This is an awesome tool!",
                "name": "hello-world",
              },
            ],
            "type": "query",
            "variables": {
              "name": "string",
            },
          },
        ],
        "resource": "http://localhost:3333",
        "version": "1",
      }
    `);
  });

  test("does not write to dev application manifest file when using a build command", async () => {
    vol.fromJSON({
      "package.json": mockPackageJson(),
      "src/my-component.tsx": declareOperation(gql`
        query HelloWorldQuery
        @tool(name: "hello-world", description: "This is an awesome tool!") {
          helloWorld
        }
      `),
    });

    await buildApp({
      mode: "production",
      plugins: [
        apolloClientAiApps({ targets: ["mcp"], appsOutDir: "dist/apps" }),
      ],
    });

    const manifest = readManifestFile();
    expect(manifest.operations).toHaveLength(1);
    expect(manifest.operations[0].name).toBe("HelloWorldQuery");
  });

  test("does not process files that do not contain gql tags", async () => {
    vol.fromJSON({
      "package.json": mockPackageJson(),
      "src/my-component.tsx": `
        const MY_QUERY = \`query HelloWorldQuery @tool(name: "hello-world", description: "This is an awesome tool!") { helloWorld }\`;
      `,
    });

    await using server = await setupServer({
      plugins: [
        apolloClientAiApps({ targets: ["mcp"], appsOutDir: "dist/apps" }),
      ],
    });
    await server.listen();

    const manifest = readManifestFile();
    expect(manifest).toMatchInlineSnapshot(`
      {
        "appVersion": "1.0.0",
        "csp": {
          "baseUriDomains": [],
          "connectDomains": [],
          "frameDomains": [],
          "redirectDomains": [],
          "resourceDomains": [],
        },
        "format": "apollo-ai-app-manifest",
        "hash": "abc",
        "name": "my-app",
        "operations": [],
        "resource": "http://localhost:3333",
        "version": "1",
      }
    `);
  });

  test("captures queries in manifest file", async () => {
    vol.fromJSON({
      "package.json": mockPackageJson(),
      "src/my-component.tsx": declareOperation(gql`
        query HelloWorldQuery {
          helloWorld
        }
      `),
    });

    await using server = await setupServer({
      plugins: [
        apolloClientAiApps({ targets: ["mcp"], appsOutDir: "dist/apps" }),
      ],
    });
    await server.listen();

    const manifest = readManifestFile();
    expect(manifest).toMatchInlineSnapshot(`
      {
        "appVersion": "1.0.0",
        "csp": {
          "baseUriDomains": [],
          "connectDomains": [],
          "frameDomains": [],
          "redirectDomains": [],
          "resourceDomains": [],
        },
        "format": "apollo-ai-app-manifest",
        "hash": "abc",
        "name": "my-app",
        "operations": [
          {
            "body": "query HelloWorldQuery {
        helloWorld
      }",
            "id": "f8604bba13e2f589608c0eb36c3039c5ef3a4c5747bc1596f9dbcbe924dc90f9",
            "name": "HelloWorldQuery",
            "prefetch": false,
            "tools": [],
            "type": "query",
            "variables": {},
          },
        ],
        "resource": "http://localhost:3333",
        "version": "1",
      }
    `);
  });

  test("captures mutations in manifest file", async () => {
    vol.fromJSON({
      "package.json": mockPackageJson(),
      "src/my-component.tsx": declareOperation(gql`
        mutation HelloWorldQuery
        @tool(name: "hello-world", description: "This is an awesome tool!") {
          helloWorld
        }
      `),
    });

    await using server = await setupServer({
      plugins: [
        apolloClientAiApps({ targets: ["mcp"], appsOutDir: "dist/apps" }),
      ],
    });
    await server.listen();

    const manifest = readManifestFile();
    expect(manifest).toMatchInlineSnapshot(`
      {
        "appVersion": "1.0.0",
        "csp": {
          "baseUriDomains": [],
          "connectDomains": [],
          "frameDomains": [],
          "redirectDomains": [],
          "resourceDomains": [],
        },
        "format": "apollo-ai-app-manifest",
        "hash": "abc",
        "name": "my-app",
        "operations": [
          {
            "body": "mutation HelloWorldQuery {
        helloWorld
      }",
            "id": "0c98e15f08542215c9c268192aaff732800bc33b79dddea7dc6fdf69c21b61a7",
            "name": "HelloWorldQuery",
            "prefetch": false,
            "tools": [
              {
                "description": "This is an awesome tool!",
                "name": "hello-world",
              },
            ],
            "type": "mutation",
            "variables": {},
          },
        ],
        "resource": "http://localhost:3333",
        "version": "1",
      }
    `);
  });

  test("errors when a subscription operation type is discovered", async () => {
    vol.fromJSON({
      "package.json": mockPackageJson(),
      "src/my-component.tsx": declareOperation(gql`
        subscription HelloWorldQuery
        @tool(name: "hello-world", description: "This is an awesome tool!") {
          helloWorld
        }
      `),
    });

    await expect(async () => {
      await using server = await setupServer({
        plugins: [
          apolloClientAiApps({ targets: ["mcp"], appsOutDir: "dist/apps" }),
        ],
      });
      await server.listen();
    }).rejects.toThrowErrorMatchingInlineSnapshot(
      `[Error: Found unsupported operation type 'subscription'. Only queries and mutations are supported.]`
    );
  });

  test("orders operations and fragments when generating normalized operation", async () => {
    vol.fromJSON({
      "package.json": mockPackageJson(),
      "src/my-component.tsx": `
        const MY_QUERY = gql\`
          fragment A on User { firstName }
          fragment B on User { lastName }
          query HelloWorldQuery @tool(name: "hello-world", description: "This is an awesome tool!") {
            helloWorld {
              ...B
              ...A
              ...C
            }

            fragment C on User { middleName }
          }\`;
      `,
    });

    await using server = await setupServer({
      plugins: [
        apolloClientAiApps({ targets: ["mcp"], appsOutDir: "dist/apps" }),
      ],
    });
    await server.listen();

    const manifest = readManifestFile();
    expect(manifest).toMatchInlineSnapshot(`
      {
        "appVersion": "1.0.0",
        "csp": {
          "baseUriDomains": [],
          "connectDomains": [],
          "frameDomains": [],
          "redirectDomains": [],
          "resourceDomains": [],
        },
        "format": "apollo-ai-app-manifest",
        "hash": "abc",
        "name": "my-app",
        "operations": [
          {
            "body": "query HelloWorldQuery {
        helloWorld {
          ...B
          ...A
          ...C
          __typename
        }
        fragment
        C
        on
        User {
          middleName
          __typename
        }
      }

      fragment A on User {
        firstName
        __typename
      }

      fragment B on User {
        lastName
        __typename
      }",
            "id": "58359ad006a8e1a6cdabe4b49c0322e8a41d71c5194a796e6432be055220b9ec",
            "name": "HelloWorldQuery",
            "prefetch": false,
            "tools": [
              {
                "description": "This is an awesome tool!",
                "name": "hello-world",
              },
            ],
            "type": "query",
            "variables": {},
          },
        ],
        "resource": "http://localhost:3333",
        "version": "1",
      }
    `);
  });
});

describe("@prefetch", () => {
  test("captures queries as prefetch when marked with @prefetch directive", async () => {
    vol.fromJSON({
      "package.json": mockPackageJson(),
      "src/my-component.tsx": declareOperation(gql`
        query HelloWorldQuery @prefetch {
          helloWorld
        }
      `),
    });

    await using server = await setupServer({
      plugins: [
        apolloClientAiApps({ targets: ["mcp"], appsOutDir: "dist/apps" }),
      ],
    });
    await server.listen();

    const manifest = readManifestFile();
    expect(manifest).toMatchInlineSnapshot(`
      {
        "appVersion": "1.0.0",
        "csp": {
          "baseUriDomains": [],
          "connectDomains": [],
          "frameDomains": [],
          "redirectDomains": [],
          "resourceDomains": [],
        },
        "format": "apollo-ai-app-manifest",
        "hash": "abc",
        "name": "my-app",
        "operations": [
          {
            "body": "query HelloWorldQuery {
        helloWorld
      }",
            "id": "f8604bba13e2f589608c0eb36c3039c5ef3a4c5747bc1596f9dbcbe924dc90f9",
            "name": "HelloWorldQuery",
            "prefetch": true,
            "prefetchID": "__anonymous",
            "tools": [],
            "type": "query",
            "variables": {},
          },
        ],
        "resource": "http://localhost:3333",
        "version": "1",
      }
    `);
  });

  test("errors when multiple operations are marked with @prefetch", async () => {
    vol.fromJSON({
      "package.json": mockPackageJson(),
      "src/my-component.tsx": [
        declareOperation(gql`
          query HelloWorldQuery @prefetch {
            helloWorld
          }
        `),
        declareOperation(gql`
          query HelloWorldQuery2 @prefetch {
            helloWorld
          }
        `),
      ].join("\n"),
    });

    await expect(async () => {
      await using server = await setupServer({
        plugins: [
          apolloClientAiApps({ targets: ["mcp"], appsOutDir: "dist/apps" }),
        ],
      });
      await server.listen();
    }).rejects.toThrowErrorMatchingInlineSnapshot(
      `[Error: Found multiple operations marked as \`@prefetch\`. You can only mark 1 operation with \`@prefetch\`.]`
    );
  });
});

describe("@tool validation", () => {
  test("errors when tool name is not provided on anonymous operation", async () => {
    vol.fromJSON({
      "package.json": mockPackageJson(),
      "src/my-component.tsx": declareOperation(gql`
        query @tool {
          helloWorld
        }
      `),
    });

    await expect(async () => {
      await using server = await setupServer({
        plugins: [
          apolloClientAiApps({ targets: ["mcp"], appsOutDir: "dist/apps" }),
        ],
      });
      await server.listen();
    }).rejects.toThrowErrorMatchingInlineSnapshot(
      `[Error: Anonymous operations cannot use @tool without providing a 'name' argument]`
    );
  });

  test("errors when tool description is not provided and operation has no description", async () => {
    vol.fromJSON({
      "package.json": mockPackageJson(),
      "src/my-component.tsx": declareOperation(gql`
        query HelloWorldQuery @tool(name: "hello-world") {
          helloWorld
        }
      `),
    });

    await expect(async () => {
      await using server = await setupServer({
        plugins: [
          apolloClientAiApps({ targets: ["mcp"], appsOutDir: "dist/apps" }),
        ],
      });
      await server.listen();
    }).rejects.toThrowErrorMatchingInlineSnapshot(
      `[Error: Operations using @tool without a 'description' argument must have a description on the operation definition]`
    );
  });

  test("uses operation name as tool name when name is omitted from @tool", async () => {
    vol.fromJSON({
      "package.json": mockPackageJson(),
      "src/my-component.tsx": declareOperation(gql`
        query HelloWorldQuery @tool(description: "A greeting tool") {
          helloWorld
        }
      `),
    });

    await using server = await setupServer({
      plugins: [
        apolloClientAiApps({ targets: ["mcp"], appsOutDir: "dist/apps" }),
      ],
    });
    await server.listen();

    const manifest = readManifestFile();
    expect(manifest.operations[0].tools).toMatchInlineSnapshot(`
      [
        {
          "description": "A greeting tool",
          "name": "HelloWorldQuery",
        },
      ]
    `);
  });

  test("uses operation description as tool description when description is omitted from @tool", async () => {
    vol.fromJSON({
      "package.json": mockPackageJson(),
      "src/my-component.tsx": declareOperation(gql`
        """
        A greeting tool
        """
        query HelloWorldQuery @tool(name: "hello-world") {
          helloWorld
        }
      `),
    });

    await using server = await setupServer({
      plugins: [
        apolloClientAiApps({ targets: ["mcp"], appsOutDir: "dist/apps" }),
      ],
    });
    await server.listen();

    const manifest = readManifestFile();
    expect(manifest.operations[0].tools).toMatchInlineSnapshot(`
      [
        {
          "description": "A greeting tool",
          "name": "hello-world",
        },
      ]
    `);
  });

  test("uses operation name and description when both are omitted from @tool", async () => {
    vol.fromJSON({
      "package.json": mockPackageJson(),
      "src/my-component.tsx": declareOperation(gql`
        """
        A greeting tool
        """
        query HelloWorldQuery @tool {
          helloWorld
        }
      `),
    });

    await using server = await setupServer({
      plugins: [
        apolloClientAiApps({ targets: ["mcp"], appsOutDir: "dist/apps" }),
      ],
    });
    await server.listen();

    const manifest = readManifestFile();
    expect(manifest.operations[0].tools).toMatchInlineSnapshot(`
      [
        {
          "description": "A greeting tool",
          "name": "HelloWorldQuery",
        },
      ]
    `);
  });

  test("errors when tool name contains spaces", async () => {
    vol.fromJSON({
      "package.json": mockPackageJson(),
      "src/my-component.tsx": declareOperation(gql`
        query HelloWorldQuery
        @tool(name: "hello world", description: "A tool") {
          helloWorld
        }
      `),
    });

    await expect(async () => {
      await using server = await setupServer({
        plugins: [
          apolloClientAiApps({ targets: ["mcp"], appsOutDir: "dist/apps" }),
        ],
      });
      await server.listen();
    }).rejects.toThrowErrorMatchingInlineSnapshot(
      `
      [Error: ✖ Tool with name "hello world" must not contain spaces
        → at name]
    `
    );
  });

  test("errors when tool name is not a string", async () => {
    vol.fromJSON({
      "package.json": mockPackageJson(),
      "src/my-component.tsx": declareOperation(gql`
        query HelloWorldQuery @tool(name: true) {
          helloWorld
        }
      `),
    });

    await expect(async () => {
      await using server = await setupServer({
        plugins: [
          apolloClientAiApps({ targets: ["mcp"], appsOutDir: "dist/apps" }),
        ],
      });
      await server.listen();
    }).rejects.toThrowErrorMatchingInlineSnapshot(
      `[Error: Expected argument 'name' to be of type 'StringValue' but found 'BooleanValue' instead.]`
    );
  });

  test("errors when tool description is not a string", async () => {
    vol.fromJSON({
      "package.json": mockPackageJson(),
      "src/my-component.tsx": declareOperation(gql`
        query HelloWorldQuery @tool(name: "hello-world", description: false) {
          helloWorld
        }
      `),
    });

    await expect(async () => {
      await using server = await setupServer({
        plugins: [
          apolloClientAiApps({ targets: ["mcp"], appsOutDir: "dist/apps" }),
        ],
      });
      await server.listen();
    }).rejects.toThrowErrorMatchingInlineSnapshot(
      `[Error: Expected argument 'description' to be of type 'StringValue' but found 'BooleanValue' instead.]`
    );
  });

  test("errors when extraInputs is not an array", async () => {
    vol.fromJSON({
      "package.json": mockPackageJson(),
      "src/my-component.tsx": declareOperation(gql`
        query HelloWorldQuery
        @tool(name: "hello-world", description: "hello", extraInputs: false) {
          helloWorld
        }
      `),
    });

    await expect(async () => {
      await using server = await setupServer({
        plugins: [
          apolloClientAiApps({ targets: ["mcp"], appsOutDir: "dist/apps" }),
        ],
      });
      await server.listen();
    }).rejects.toThrowErrorMatchingInlineSnapshot(
      `[Error: Expected argument 'extraInputs' to be of type 'ListValue' but found 'BooleanValue' instead.]`
    );
  });

  test("errors when an unknown type is discovered", async () => {
    vol.fromJSON({
      "package.json": mockPackageJson(),
      "src/my-component.tsx": declareOperation(gql`
        query HelloWorldQuery
        @tool(
          name: "hello-world"
          description: "hello"
          extraInputs: [{ name: 3.1 }]
        ) {
          helloWorld
        }
      `),
    });

    await expect(async () => {
      await using server = await setupServer({
        plugins: [
          apolloClientAiApps({ targets: ["mcp"], appsOutDir: "dist/apps" }),
        ],
      });
      await server.listen();
    }).rejects.toThrowErrorMatchingInlineSnapshot(
      `[Error: Error when parsing directive values: unexpected type 'FloatValue']`
    );
  });

  test("errors when multiple @tool directives are used and one is missing a name", async () => {
    vol.fromJSON({
      "package.json": mockPackageJson(),
      "src/my-component.tsx": declareOperation(gql`
        query HelloWorldQuery
        @tool(name: "tool-a", description: "Tool A")
        @tool(description: "Tool B") {
          helloWorld
        }
      `),
    });

    await expect(async () => {
      await using server = await setupServer({
        plugins: [
          apolloClientAiApps({ targets: ["mcp"], appsOutDir: "dist/apps" }),
        ],
      });
      await server.listen();
    }).rejects.toThrowErrorMatchingInlineSnapshot(
      `[Error: Operations with multiple @tool directives must provide a 'name' argument on each @tool]`
    );
  });

  test("errors when multiple @tool directives are used and one is missing a description", async () => {
    vol.fromJSON({
      "package.json": mockPackageJson(),
      "src/my-component.tsx": declareOperation(gql`
        query HelloWorldQuery
        @tool(name: "tool-a", description: "Tool A")
        @tool(name: "tool-b") {
          helloWorld
        }
      `),
    });

    await expect(async () => {
      await using server = await setupServer({
        plugins: [
          apolloClientAiApps({ targets: ["mcp"], appsOutDir: "dist/apps" }),
        ],
      });
      await server.listen();
    }).rejects.toThrowErrorMatchingInlineSnapshot(
      `[Error: Operations with multiple @tool directives must provide a 'description' argument on each @tool]`
    );
  });
});

describe("config validation", () => {
  test("errors when widgetSettings.prefersBorder is not a boolean", async () => {
    vol.fromJSON({
      "package.json": mockPackageJson({
        "apollo-client-ai-apps": {
          widgetSettings: {
            prefersBorder: "test",
          },
        },
      }),
      "src/my-component.tsx": declareOperation(gql`
        query HelloWorldQuery @tool(name: "test", description: "Test") {
          helloWorld
        }
      `),
    });

    await expect(async () => {
      await using server = await setupServer({
        plugins: [
          apolloClientAiApps({ targets: ["mcp"], appsOutDir: "dist/apps" }),
        ],
      });
      await server.listen();
    }).rejects.toThrowErrorMatchingInlineSnapshot(
      `
      "✖ Invalid input: expected boolean, received string
        → at widgetSettings.prefersBorder"
    `
    );
  });

  test("errors when widgetSettings.description is not a string", async () => {
    vol.fromJSON({
      "package.json": mockPackageJson({
        "apollo-client-ai-apps": {
          widgetSettings: {
            description: true,
          },
        },
      }),
      "src/my-component.tsx": declareOperation(gql`
        query HelloWorldQuery @tool(name: "test", description: "Test") {
          helloWorld
        }
      `),
    });

    await expect(async () => {
      await using server = await setupServer({
        plugins: [
          apolloClientAiApps({ targets: ["mcp"], appsOutDir: "dist/apps" }),
        ],
      });
      await server.listen();
    }).rejects.toThrowErrorMatchingInlineSnapshot(
      `
      "✖ Invalid input: expected string, received boolean
        → at widgetSettings.description"
    `
    );
  });

  test("errors when widgetSettings.domain is not a string", async () => {
    vol.fromJSON({
      "package.json": mockPackageJson({
        "apollo-client-ai-apps": {
          widgetSettings: {
            domain: true,
          },
        },
      }),
      "src/my-component.tsx": declareOperation(gql`
        query HelloWorldQuery @tool(name: "test", description: "Test") {
          helloWorld
        }
      `),
    });

    await expect(async () => {
      await using server = await setupServer({
        plugins: [
          apolloClientAiApps({ targets: ["mcp"], appsOutDir: "dist/apps" }),
        ],
      });
      await server.listen();
    }).rejects.toThrowErrorMatchingInlineSnapshot(
      `
      "✖ Invalid input: expected string, received boolean
        → at widgetSettings.domain"
    `
    );
  });

  test("allows empty widgetSettings value", async () => {
    vol.fromJSON({
      "package.json": mockPackageJson({
        widgetSettings: {},
      }),
      "src/my-component.tsx": declareOperation(gql`
        query HelloWorldQuery @tool(name: "test", description: "Test") {
          helloWorld
        }
      `),
    });

    await using server = await setupServer({
      plugins: [
        apolloClientAiApps({ targets: ["mcp"], appsOutDir: "dist/apps" }),
      ],
    });
    await server.listen();

    const manifest = readManifestFile();
    expect(manifest.operations).toHaveLength(1);
  });

  test("errors when labels.toolInvocation.invoking in package.json is not a string", async () => {
    vol.fromJSON({
      "package.json": mockPackageJson({
        "apollo-client-ai-apps": {
          labels: {
            toolInvocation: {
              invoking: true,
            },
          },
        },
      }),
      "src/my-component.tsx": declareOperation(gql`
        query HelloWorldQuery @tool(name: "test", description: "Test") {
          helloWorld
        }
      `),
    });

    await expect(async () => {
      await using server = await setupServer({
        plugins: [
          apolloClientAiApps({ targets: ["mcp"], appsOutDir: "dist/apps" }),
        ],
      });
      await server.listen();
    }).rejects.toThrowErrorMatchingInlineSnapshot(
      `
      "✖ Invalid input: expected string, received boolean
        → at labels.toolInvocation.invoking"
    `
    );
  });

  test("errors when labels.toolInvocation.invoking in @tool is not a string", async () => {
    vol.fromJSON({
      "package.json": mockPackageJson(),
      "src/my-component.tsx": declareOperation(gql`
        query HelloWorldQuery
        @tool(
          name: "test"
          description: "Test"
          labels: { toolInvocation: { invoking: true } }
        ) {
          helloWorld
        }
      `),
    });

    await expect(async () => {
      await using server = await setupServer({
        plugins: [
          apolloClientAiApps({ targets: ["mcp"], appsOutDir: "dist/apps" }),
        ],
      });
      await server.listen();
    }).rejects.toThrowErrorMatchingInlineSnapshot(
      `
      [Error: ✖ Invalid input: expected string, received boolean
        → at labels.toolInvocation.invoking]
    `
    );
  });

  test("errors when labels.toolInvocation.invoked in package.json is not a string", async () => {
    vol.fromJSON({
      "package.json": mockPackageJson({
        "apollo-client-ai-apps": {
          labels: {
            toolInvocation: {
              invoked: true,
            },
          },
        },
      }),
      "src/my-component.tsx": declareOperation(gql`
        query HelloWorldQuery @tool(name: "test", description: "Test") {
          helloWorld
        }
      `),
    });

    await expect(async () => {
      await using server = await setupServer({
        plugins: [
          apolloClientAiApps({ targets: ["mcp"], appsOutDir: "dist/apps" }),
        ],
      });
      await server.listen();
    }).rejects.toThrowErrorMatchingInlineSnapshot(
      `
      "✖ Invalid input: expected string, received boolean
        → at labels.toolInvocation.invoked"
    `
    );
  });

  test("errors when labels.toolInvocation.invoked in @tool is not a string", async () => {
    vol.fromJSON({
      "package.json": mockPackageJson(),
      "src/my-component.tsx": declareOperation(gql`
        query HelloWorldQuery
        @tool(
          name: "test"
          description: "Test"
          labels: { toolInvocation: { invoked: true } }
        ) {
          helloWorld
        }
      `),
    });

    await expect(async () => {
      await using server = await setupServer({
        plugins: [
          apolloClientAiApps({ targets: ["mcp"], appsOutDir: "dist/apps" }),
        ],
      });
      await server.listen();
    }).rejects.toThrowErrorMatchingInlineSnapshot(
      `
      [Error: ✖ Invalid input: expected string, received boolean
        → at labels.toolInvocation.invoked]
    `
    );
  });

  test("allows empty labels value", async () => {
    vol.fromJSON({
      "package.json": mockPackageJson({ labels: {} }),
      "src/my-component.tsx": declareOperation(gql`
        query HelloWorldQuery
        @tool(name: "test", description: "Test", labels: {}) {
          helloWorld
        }
      `),
    });

    await using server = await setupServer({
      plugins: [
        apolloClientAiApps({ targets: ["mcp"], appsOutDir: "dist/apps" }),
      ],
    });
    await server.listen();

    const manifest = readManifestFile();
    expect(manifest.operations).toHaveLength(1);
  });
});

describe("entry points", () => {
  test("uses custom entry point when in serve mode and provided in package.json", async () => {
    vol.fromJSON({
      "package.json": mockPackageJson({
        "apollo-client-ai-apps": {
          entry: {
            staging: "http://staging.awesome.com",
          },
        },
      }),
      "src/my-component.tsx": declareOperation(gql`
        query HelloWorldQuery
        @tool(name: "hello-world", description: "This is an awesome tool!") {
          helloWorld
        }
      `),
    });

    await using server = await setupServer({
      mode: "staging",
      plugins: [
        apolloClientAiApps({ targets: ["mcp"], appsOutDir: "dist/apps" }),
      ],
    });
    await server.listen();

    const manifest = readManifestFile();
    expect(manifest.resource).toBe("http://staging.awesome.com");
  });

  test("uses custom entry point for devTarget when in serve mode and provided in package.json", async () => {
    vol.fromJSON({
      "package.json": mockPackageJson({
        "apollo-client-ai-apps": {
          entry: {
            staging: {
              mcp: "http://staging.awesome.com",
            },
          },
        },
      }),
      "src/my-component.tsx": declareOperation(gql`
        query HelloWorldQuery
        @tool(name: "hello-world", description: "This is an awesome tool!") {
          helloWorld
        }
      `),
    });

    await using server = await setupServer({
      mode: "staging",
      plugins: [
        apolloClientAiApps({
          targets: ["mcp"],
          devTarget: "mcp",
          appsOutDir: "dist/apps",
        }),
      ],
    });
    await server.listen();

    const manifest = readManifestFile();
    expect(manifest.resource).toBe("http://staging.awesome.com");
  });

  test("uses https when enabled in server config", async () => {
    vol.fromJSON({
      "package.json": mockPackageJson(),
      "src/my-component.tsx": declareOperation(gql`
        query HelloWorldQuery
        @tool(name: "hello-world", description: "This is an awesome tool!") {
          helloWorld
        }
      `),
    });

    await using server = await setupServer({
      server: { https: {}, port: 5678 },
      plugins: [
        apolloClientAiApps({ targets: ["mcp"], appsOutDir: "dist/apps" }),
      ],
    });
    await server.listen();

    const manifest = readManifestFile();
    expect(manifest.resource).toBe("https://localhost:5678");
  });

  test("uses custom host when specified in server config", async () => {
    vol.fromJSON({
      "package.json": mockPackageJson(),
      "src/my-component.tsx": declareOperation(gql`
        query HelloWorldQuery
        @tool(name: "hello-world", description: "This is an awesome tool!") {
          helloWorld
        }
      `),
    });

    await using server = await setupServer({
      server: { port: 5678, host: "0.0.0.0" },
      plugins: [
        apolloClientAiApps({ targets: ["mcp"], appsOutDir: "dist/apps" }),
      ],
    });
    await server.listen();

    const manifest = readManifestFile();
    expect(manifest.resource).toBe("http://0.0.0.0:5678");
  });

  test("uses custom entry point when in build mode and provided in package.json", async () => {
    vol.fromJSON({
      "package.json": mockPackageJson({
        "apollo-client-ai-apps": {
          entry: {
            staging: "http://staging.awesome.com",
          },
        },
      }),
      "src/my-component.tsx": declareOperation(gql`
        query HelloWorldQuery
        @tool(name: "hello-world", description: "This is an awesome tool!") {
          helloWorld
        }
      `),
    });

    await buildApp({
      mode: "staging",
      plugins: [
        apolloClientAiApps({ targets: ["mcp"], appsOutDir: "dist/apps" }),
      ],
    });

    const manifest = readManifestFile();
    expect(manifest.resource).toEqual({ mcp: "http://staging.awesome.com" });
  });

  test("uses custom entry point for target when in build mode with multiple targets", async () => {
    vol.fromJSON({
      "package.json": mockPackageJson({
        "apollo-client-ai-apps": {
          entry: {
            staging: {
              mcp: "http://staging-mcp.awesome.com",
              openai: "http://staging-openai.awesome.com",
            },
          },
        },
      }),
      "src/my-component.tsx": declareOperation(gql`
        query HelloWorldQuery
        @tool(name: "hello-world", description: "This is an awesome tool!") {
          helloWorld
        }
      `),
    });

    await buildApp({
      mode: "staging",
      plugins: [
        apolloClientAiApps({
          targets: ["mcp", "openai"],
          appsOutDir: "dist/apps",
        }),
      ],
    });

    const manifest = readManifestFile();
    expect(manifest.resource).toEqual({
      mcp: "http://staging-mcp.awesome.com",
      openai: "http://staging-openai.awesome.com",
    });
  });

  test("uses custom entry point for all targets when in build mode with multiple targets", async () => {
    vol.fromJSON({
      "package.json": mockPackageJson({
        "apollo-client-ai-apps": {
          entry: {
            staging: "http://staging.awesome.com",
          },
        },
      }),
      "src/my-component.tsx": declareOperation(gql`
        query HelloWorldQuery
        @tool(name: "hello-world", description: "This is an awesome tool!") {
          helloWorld
        }
      `),
    });

    await buildApp({
      mode: "staging",
      plugins: [
        apolloClientAiApps({
          targets: ["mcp", "openai"],
          appsOutDir: "dist/apps",
        }),
      ],
    });

    const manifest = readManifestFile();
    expect(manifest.resource).toEqual({
      mcp: "http://staging.awesome.com",
      openai: "http://staging.awesome.com",
    });
  });

  test("uses custom entry point for target when in build mode with single target", async () => {
    vol.fromJSON({
      "package.json": mockPackageJson({
        "apollo-client-ai-apps": {
          entry: {
            staging: {
              mcp: "http://staging-mcp.awesome.com",
            },
          },
        },
      }),
      "src/my-component.tsx": declareOperation(gql`
        query HelloWorldQuery
        @tool(name: "hello-world", description: "This is an awesome tool!") {
          helloWorld
        }
      `),
    });

    await buildApp({
      mode: "staging",
      plugins: [
        apolloClientAiApps({ targets: ["mcp"], appsOutDir: "dist/apps" }),
      ],
    });

    const manifest = readManifestFile();
    expect(manifest.resource).toEqual({
      mcp: "http://staging-mcp.awesome.com",
    });
  });

  test("uses [target]/index.html when in build production and not provided in package.json with single target", async () => {
    vol.fromJSON({
      "package.json": mockPackageJson(),
      "src/my-component.tsx": declareOperation(gql`
        query HelloWorldQuery
        @tool(name: "hello-world", description: "This is an awesome tool!") {
          helloWorld
        }
      `),
    });

    await buildApp({
      mode: "production",
      plugins: [
        apolloClientAiApps({ targets: ["mcp"], appsOutDir: "dist/apps" }),
      ],
    });

    const manifest = readManifestFile();
    expect(manifest.resource).toEqual({ mcp: "mcp/index.html" });
  });

  test("uses [target]/index.html when in build production with multiple targets", async () => {
    vol.fromJSON({
      "package.json": mockPackageJson(),
      "src/my-component.tsx": declareOperation(gql`
        query HelloWorldQuery
        @tool(name: "hello-world", description: "This is an awesome tool!") {
          helloWorld
        }
      `),
    });

    await buildApp({
      mode: "production",
      plugins: [
        apolloClientAiApps({
          targets: ["mcp", "openai"],
          appsOutDir: "dist/apps",
        }),
      ],
    });

    const manifest = readManifestFile();
    expect(manifest.resource).toEqual({
      mcp: "mcp/index.html",
      openai: "openai/index.html",
    });
  });

  test("errors when in build mode and using a mode that is not production and not provided in package.json", async () => {
    vol.fromJSON({
      "package.json": mockPackageJson(),
      "src/my-component.tsx": declareOperation(gql`
        query HelloWorldQuery
        @tool(name: "hello-world", description: "This is an awesome tool!") {
          helloWorld
        }
      `),
    });

    await expect(
      async () =>
        await buildApp({
          mode: "staging",
          plugins: [
            apolloClientAiApps({ targets: ["mcp"], appsOutDir: "dist/apps" }),
          ],
        })
    ).rejects.toThrowError(
      `[@apollo/client-ai-apps/vite] No entry point found for mode "staging". Entry points other than "development" and "production" must be defined in package.json file.`
    );
  });

  test("writes to both locations when running in build mode", async () => {
    vol.fromJSON({
      "package.json": mockPackageJson(),
      "src/my-component.tsx": declareOperation(gql`
        query HelloWorldQuery
        @tool(name: "hello-world", description: "This is an awesome tool!") {
          helloWorld
        }
      `),
    });

    await buildApp({
      mode: "production",
      plugins: [
        apolloClientAiApps({ targets: ["mcp"], appsOutDir: "dist/apps" }),
      ],
    });

    expect(vol.existsSync(".application-manifest.json")).toBe(true);
    expect(vol.existsSync("dist/apps/my-app/.application-manifest.json")).toBe(
      true
    );
  });

  test("writes to both locations when running in build mode with multiple targets", async () => {
    vol.fromJSON({
      "package.json": mockPackageJson(),
      "src/my-component.tsx": declareOperation(gql`
        query HelloWorldQuery
        @tool(name: "hello-world", description: "This is an awesome tool!") {
          helloWorld
        }
      `),
    });

    await buildApp({
      mode: "production",
      plugins: [
        apolloClientAiApps({
          targets: ["mcp", "openai"],
          appsOutDir: "dist/apps",
        }),
      ],
    });

    expect(vol.existsSync(".application-manifest.json")).toBe(true);
    expect(vol.existsSync("dist/apps/my-app/.application-manifest.json")).toBe(
      true
    );
  });

  test("generates .application-manifest.d.json.ts at root in build mode", async () => {
    vol.fromJSON({
      "package.json": mockPackageJson(),
      "src/my-component.tsx": declareOperation(gql`
        query HelloWorldQuery
        @tool(name: "hello-world", description: "This is an awesome tool!") {
          helloWorld
        }
      `),
    });

    await buildApp({
      mode: "production",
      plugins: [
        apolloClientAiApps({ targets: ["mcp"], appsOutDir: "dist/apps" }),
      ],
    });

    expect(vol.existsSync(".application-manifest.d.json.ts")).toBe(true);
  });

  test("generates .application-manifest.d.json.ts at root in serve mode", async () => {
    vol.fromJSON({
      "package.json": mockPackageJson(),
      "src/my-component.tsx": declareOperation(gql`
        query HelloWorldQuery
        @tool(name: "hello-world", description: "This is an awesome tool!") {
          helloWorld
        }
      `),
    });

    await using server = await setupServer({
      plugins: [
        apolloClientAiApps({ targets: ["mcp"], appsOutDir: "dist/apps" }),
      ],
    });
    await server.listen();

    expect(vol.existsSync(".application-manifest.d.json.ts")).toBe(true);
  });

  test("does not write .application-manifest.json.d.ts to appsOutDir", async () => {
    vol.fromJSON({
      "package.json": mockPackageJson(),
      "src/my-component.tsx": declareOperation(gql`
        query HelloWorldQuery
        @tool(name: "hello-world", description: "This is an awesome tool!") {
          helloWorld
        }
      `),
    });

    await buildApp({
      mode: "production",
      plugins: [
        apolloClientAiApps({ targets: ["mcp"], appsOutDir: "dist/apps" }),
      ],
    });

    expect(
      vol.existsSync("dist/apps/my-app/.application-manifest.json.d.ts")
    ).toBe(false);
  });
});

describe("appsOutDir", () => {
  test("errors when last segment is not `apps`", () => {
    expect(() =>
      apolloClientAiApps({ targets: ["mcp"], appsOutDir: "dist/output" })
    ).toThrowError(
      "`appsOutDir` must end with `apps` as the final path segment (e.g. `path/to/apps`)."
    );
  });

  test("accepts trailing slash", async () => {
    vol.fromJSON({
      "package.json": mockPackageJson(),
    });

    await expect(
      buildApp({
        mode: "production",
        build: { write: false },
        plugins: [
          apolloClientAiApps({ targets: ["mcp"], appsOutDir: "dist/apps/" }),
        ],
      })
    ).resolves.not.toThrowError();
  });

  test("warns when `build.outDir` is set", async () => {
    vol.fromJSON({
      "package.json": mockPackageJson(),
    });

    using _ = spyOnConsole("warn");

    await buildApp({
      mode: "production",
      build: { outDir: "custom-out", write: false },
      plugins: [
        apolloClientAiApps({ targets: ["mcp"], appsOutDir: "dist/apps" }),
      ],
    });

    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        "`build.outDir` is set in your Vite config but will be ignored"
      )
    );
  });

  test("places output under `appsOutDir`", async () => {
    vol.fromJSON({
      "package.json": mockPackageJson(),
      "src/my-component.tsx": declareOperation(gql`
        query HelloWorldQuery
        @tool(name: "hello-world", description: "This is an awesome tool!") {
          helloWorld
        }
      `),
    });

    await buildApp({
      mode: "production",
      plugins: [
        apolloClientAiApps({ targets: ["mcp"], appsOutDir: "dist/apps" }),
      ],
    });

    expect(vol.existsSync("dist/apps/my-app/.application-manifest.json")).toBe(
      true
    );
    expect(vol.existsSync(".application-manifest.json")).toBe(true);
  });
});

describe("config files", () => {
  const appConfigName = "test-app";
  const appConfigDescription = "test description";

  const json = JSON.stringify({
    name: appConfigName,
    description: appConfigDescription,
  });
  const yaml = `
name: "${appConfigName}"
description: "${appConfigDescription}"
`;
  const cjs = `
module.exports = {
  name: "${appConfigName}",
  description: "${appConfigDescription}",
}
`;
  const mjs = `
export default {
  name: "${appConfigName}",
  description: "${appConfigDescription}"
}
`;
  const ts = `
import type { ApolloAiAppsConfig } from "@apollo/client-ai-apps/config";

const config: ApolloAiAppsConfig.Config = {
  name: "${appConfigName}",
  description: "${appConfigDescription}",
}

export default config;
`;

  test("reads config from package.json", async () => {
    vol.fromJSON({
      "package.json": mockPackageJson({
        "apollo-client-ai-apps": JSON.parse(json),
      }),
    });

    await buildApp({
      mode: "production",
      plugins: [
        apolloClientAiApps({ targets: ["mcp"], appsOutDir: "dist/apps" }),
      ],
    });

    const manifest = readManifestFile();
    expect(manifest).toMatchObject({
      name: appConfigName,
      description: appConfigDescription,
    });
  });

  test.each([
    [".apollo-client-ai-apps.config.json", json],
    ["apollo-client-ai-apps.config.json", json],
    [".apollo-client-ai-apps.config.yml", yaml],
    ["apollo-client-ai-apps.config.yml", yaml],
    [".apollo-client-ai-apps.config.yaml", yaml],
    ["apollo-client-ai-apps.config.yaml", yaml],
    [".apollo-client-ai-apps.config.js", cjs],
    ["apollo-client-ai-apps.config.js", cjs],
    [".apollo-client-ai-apps.config.ts", ts],
    ["apollo-client-ai-apps.config.ts", ts],
    [".apollo-client-ai-apps.config.cjs", cjs],
    ["apollo-client-ai-apps.config.cjs", cjs],
    [".apollo-client-ai-apps.config.mjs", mjs],
    ["apollo-client-ai-apps.config.mjs", mjs],
  ])("reads config from %s", async (filepath, contents) => {
    using _ = interceptWriteESMtoCJS();
    using __ = await tmpWriteRealFile(filepath, contents);

    vol.fromJSON({
      "package.json": mockPackageJson(),
      [filepath]: contents.trimStart(),
    });

    await buildApp({
      mode: "production",
      plugins: [
        apolloClientAiApps({ targets: ["mcp"], appsOutDir: "dist/apps" }),
      ],
    });

    const manifest = readManifestFile();
    expect(manifest).toMatchObject({
      name: appConfigName,
      description: appConfigDescription,
    });
  });
});

describe("file watching", () => {
  test("updates manifest file when a source file is changed", async () => {
    vol.fromJSON({
      "package.json": mockPackageJson(),
      "src/my-component.tsx": declareOperation(gql`
        query HelloWorldQuery($name: string!)
        @tool(
          name: "hello-world"
          description: "This is an awesome tool!"
          extraInputs: [
            {
              name: "doStuff"
              type: "boolean"
              description: "Should we do stuff?"
            }
          ]
        ) {
          helloWorld(name: $name)
        }
      `),
    });

    await using server = await setupServer({
      plugins: [
        apolloClientAiApps({ targets: ["mcp"], appsOutDir: "dist/apps" }),
      ],
    });
    await server.listen();

    const manifestBefore = readManifestFile();
    expect(manifestBefore.operations).toHaveLength(1);

    vol.writeFileSync(
      "src/my-component.tsx",
      declareOperation(gql`
        query UpdatedQuery($name: string!)
        @tool(name: "updated-tool", description: "Updated tool!") {
          updatedWorld(name: $name)
        }
      `)
    );

    server.watcher.emit("change", process.cwd() + "/src/my-component.tsx");

    // Allow async handlers to complete
    await new Promise((resolve) => setTimeout(resolve, 100));

    const manifestAfter = readManifestFile();
    expect(manifestAfter.operations).toHaveLength(1);
    expect(manifestAfter.operations[0].name).toBe("UpdatedQuery");
  });
});

describe("tool input types", () => {
  const schema = `
    type Query {
      todo(id: ID!): Todo
    }

    type Mutation {
      createTodo(title: String!, description: String): Todo
      deleteTodo(id: ID!): Boolean
    }

    type Todo {
      id: ID!
      title: String!
      description: String
    }
  `;

  test("generates operation-types.d.ts with variable types when schema is provided", async () => {
    vol.fromJSON({
      "package.json": mockPackageJson(),
      "src/my-component.tsx": declareOperation(gql`
        mutation CreateTodo($title: String!, $description: String)
        @tool(name: "CreateTodo", description: "Creates a todo") {
          createTodo(title: $title, description: $description) {
            id
          }
        }
      `),
    });

    await using server = await setupServer({
      plugins: [
        apolloClientAiApps({
          targets: ["mcp"],
          appsOutDir: "dist/apps",
          schema,
        }),
      ],
    });
    await server.listen();

    const content = fs.readFileSync(
      ".apollo-client-ai-apps/types/operation-types.d.ts",
      "utf-8"
    );
    expect(content).toMatchInlineSnapshot(`
      "// Auto-generated by @apollo/client-ai-apps. Do not edit manually.
      export type Maybe<T> = T | null;

      export type InputMaybe<T> = Maybe<T>;

      export type Exact<T extends {
        [key: string]: unknown;
      }> = {
        [K in keyof T]: T[K];
      };

      /** All built-in and custom scalars, mapped to their actual values */
      export type Scalars = {
        ID: {
          input: string;
          output: string;
        };
        String: {
          input: string;
          output: string;
        };
        Boolean: {
          input: boolean;
          output: boolean;
        };
        Int: {
          input: number;
          output: number;
        };
        Float: {
          input: number;
          output: number;
        };
      };

      export type CreateTodoMutationVariables = Exact<{
        title: Scalars["String"]["input"];
        description?: InputMaybe<Scalars["String"]["input"]>;
      }>;"
    `);
  });

  test("generates register.d.ts with toolInputs when schema is provided", async () => {
    vol.fromJSON({
      "package.json": mockPackageJson(),
      "src/my-component.tsx": declareOperation(gql`
        mutation CreateTodo($title: String!, $description: String)
        @tool(name: "CreateTodo", description: "Creates a todo") {
          createTodo(title: $title, description: $description) {
            id
          }
        }
      `),
    });

    await using server = await setupServer({
      plugins: [
        apolloClientAiApps({
          targets: ["mcp"],
          appsOutDir: "dist/apps",
          schema,
        }),
      ],
    });
    await server.listen();

    const content = fs.readFileSync(
      ".apollo-client-ai-apps/types/register.d.ts",
      "utf-8"
    );
    expect(content).toMatchInlineSnapshot(`
      "// This file is auto-generated by @apollo/client-ai-apps. Do not edit manually.
      import "@apollo/client-ai-apps";

      import type { CreateTodoMutationVariables } from "./operation-types.js";

      declare module "@apollo/client-ai-apps" {
        interface Register {
          toolName: "CreateTodo";
          toolInputs: {
            "CreateTodo": CreateTodoMutationVariables;
          };
        }
      }"
    `);
  });

  test("generates register.d.ts with operations that contain fragments", async () => {
    vol.fromJSON({
      "package.json": mockPackageJson(),
      "src/my-component.tsx": declareOperation(gql`
        mutation CreateTodo($title: String!, $description: String)
        @tool(name: "CreateTodo", description: "Creates a todo") {
          createTodo(title: $title, description: $description) {
            id
            ...TodoFragment
          }
        }
      `),
      "src/todo-fragment.tsx": declareFragment(gql`
        fragment TodoFragment on Todo {
          title
        }
      `),
    });

    await using server = await setupServer({
      plugins: [
        apolloClientAiApps({
          targets: ["mcp"],
          appsOutDir: "dist/apps",
          schema,
        }),
      ],
    });
    await server.listen();

    expect(
      fs.readFileSync(".apollo-client-ai-apps/types/register.d.ts", "utf-8")
    ).toMatchInlineSnapshot(`
      "// This file is auto-generated by @apollo/client-ai-apps. Do not edit manually.
      import "@apollo/client-ai-apps";

      import type { CreateTodoMutationVariables } from "./operation-types.js";

      declare module "@apollo/client-ai-apps" {
        interface Register {
          toolName: "CreateTodo";
          toolInputs: {
            "CreateTodo": CreateTodoMutationVariables;
          };
        }
      }"
    `);
    expect(
      fs.readFileSync(
        ".apollo-client-ai-apps/types/operation-types.d.ts",
        "utf-8"
      )
    ).toMatchInlineSnapshot(`
      "// Auto-generated by @apollo/client-ai-apps. Do not edit manually.
      export type Maybe<T> = T | null;

      export type InputMaybe<T> = Maybe<T>;

      export type Exact<T extends {
        [key: string]: unknown;
      }> = {
        [K in keyof T]: T[K];
      };

      /** All built-in and custom scalars, mapped to their actual values */
      export type Scalars = {
        ID: {
          input: string;
          output: string;
        };
        String: {
          input: string;
          output: string;
        };
        Boolean: {
          input: boolean;
          output: boolean;
        };
        Int: {
          input: number;
          output: number;
        };
        Float: {
          input: number;
          output: number;
        };
      };

      export type CreateTodoMutationVariables = Exact<{
        title: Scalars["String"]["input"];
        description?: InputMaybe<Scalars["String"]["input"]>;
      }>;"
    `);
  });

  test("tool with no extraInputs uses only the Variables type", async () => {
    vol.fromJSON({
      "package.json": mockPackageJson(),
      "src/my-component.tsx": declareOperation(gql`
        mutation DeleteTodo($id: ID!)
        @tool(name: "DeleteTodo", description: "Deletes a todo") {
          deleteTodo(id: $id)
        }
      `),
    });

    await using server = await setupServer({
      plugins: [
        apolloClientAiApps({
          targets: ["mcp"],
          appsOutDir: "dist/apps",
          schema,
        }),
      ],
    });
    await server.listen();

    const content = fs.readFileSync(
      ".apollo-client-ai-apps/types/register.d.ts",
      "utf-8"
    );
    expect(content).toMatchInlineSnapshot(`
      "// This file is auto-generated by @apollo/client-ai-apps. Do not edit manually.
      import "@apollo/client-ai-apps";

      import type { DeleteTodoMutationVariables } from "./operation-types.js";

      declare module "@apollo/client-ai-apps" {
        interface Register {
          toolName: "DeleteTodo";
          toolInputs: {
            "DeleteTodo": DeleteTodoMutationVariables;
          };
        }
      }"
    `);
  });

  test("tool with extraInputs adds properties to tool input type", async () => {
    vol.fromJSON({
      "package.json": mockPackageJson(),
      "src/my-component.tsx": declareOperation(gql`
        mutation CreateTodo($title: String!)
        @tool(
          name: "CreateTodo"
          description: "Creates a todo"
          extraInputs: [
            { name: "priority", type: "string", description: "Priority" }
            { name: "urgent", type: "boolean", description: "Is urgent?" }
          ]
        ) {
          createTodo(title: $title) {
            id
          }
        }
      `),
    });

    await using server = await setupServer({
      plugins: [
        apolloClientAiApps({
          targets: ["mcp"],
          appsOutDir: "dist/apps",
          schema,
        }),
      ],
    });
    await server.listen();

    const content = fs.readFileSync(
      ".apollo-client-ai-apps/types/register.d.ts",
      "utf-8"
    );
    expect(content).toMatchInlineSnapshot(`
      "// This file is auto-generated by @apollo/client-ai-apps. Do not edit manually.
      import "@apollo/client-ai-apps";

      import type { CreateTodoMutationVariables } from "./operation-types.js";

      declare module "@apollo/client-ai-apps" {
        interface Register {
          toolName: "CreateTodo";
          toolInputs: {
            "CreateTodo": CreateTodoMutationVariables & {
              priority?: string;
              urgent?: boolean;
            };
          };
        }
      }"
    `);
  });

  test("multiple @tool directives on an operation each get their own toolInputs entry", async () => {
    vol.fromJSON({
      "package.json": mockPackageJson(),
      "src/my-component.tsx": declareOperation(gql`
        mutation CreateTodo($title: String!)
        @tool(name: "CreateTodo", description: "Creates a todo")
        @tool(name: "AddTask", description: "Adds a task") {
          createTodo(title: $title) {
            id
          }
        }
      `),
    });

    await using server = await setupServer({
      plugins: [
        apolloClientAiApps({
          targets: ["mcp"],
          appsOutDir: "dist/apps",
          schema,
        }),
      ],
    });
    await server.listen();

    const content = fs.readFileSync(
      ".apollo-client-ai-apps/types/register.d.ts",
      "utf-8"
    );
    expect(content).toMatchInlineSnapshot(`
      "// This file is auto-generated by @apollo/client-ai-apps. Do not edit manually.
      import "@apollo/client-ai-apps";

      import type { CreateTodoMutationVariables } from "./operation-types.js";

      declare module "@apollo/client-ai-apps" {
        interface Register {
          toolName: "CreateTodo" | "AddTask";
          toolInputs: {
            "CreateTodo": CreateTodoMutationVariables;
            "AddTask": CreateTodoMutationVariables;
          };
        }
      }"
    `);
  });

  test("operation-types.d.ts is not rewritten when operation content has not changed", async () => {
    vol.fromJSON({
      "package.json": mockPackageJson(),
      "src/my-component.tsx": declareOperation(gql`
        mutation CreateTodo($title: String!)
        @tool(name: "CreateTodo", description: "Creates a todo") {
          createTodo(title: $title) {
            id
          }
        }
      `),
    });

    await using server = await setupServer({
      plugins: [
        apolloClientAiApps({
          targets: ["mcp"],
          appsOutDir: "dist/apps",
          schema,
        }),
      ],
    });
    await server.listen();

    const content = fs.readFileSync(
      ".apollo-client-ai-apps/types/operation-types.d.ts",
      "utf-8"
    );
    const mtime = fs.statSync(
      ".apollo-client-ai-apps/types/operation-types.d.ts"
    ).mtimeMs;

    // Trigger another manifest generation (simulating a file change to an unrelated file)
    server.watcher.emit("change", "package.json");
    await wait(100);

    expect(
      fs.readFileSync(
        ".apollo-client-ai-apps/types/operation-types.d.ts",
        "utf-8"
      )
    ).toBe(content);

    expect(
      fs.statSync(".apollo-client-ai-apps/types/operation-types.d.ts").mtimeMs
    ).toBe(mtime);
  });

  test("does not generate operation-types.d.ts when schema is not provided", async () => {
    vol.fromJSON({
      "package.json": mockPackageJson(),
      "src/my-component.tsx": declareOperation(gql`
        mutation CreateTodo($title: String!)
        @tool(name: "CreateTodo", description: "Creates a todo") {
          createTodo(title: $title) {
            id
          }
        }
      `),
    });

    await using server = await setupServer({
      plugins: [
        apolloClientAiApps({ targets: ["mcp"], appsOutDir: "dist/apps" }),
      ],
    });
    await server.listen();

    expect(
      fs.existsSync(".apollo-client-ai-apps/types/operation-types.d.ts")
    ).toBe(false);
  });

  test("generates register.d.ts without toolInputs when schema is not provided", async () => {
    vol.fromJSON({
      "package.json": mockPackageJson(),
      "src/my-component.tsx": declareOperation(gql`
        mutation CreateTodo($title: String!)
        @tool(name: "CreateTodo", description: "Creates a todo") {
          createTodo(title: $title) {
            id
          }
        }
      `),
    });

    await using server = await setupServer({
      plugins: [
        apolloClientAiApps({ targets: ["mcp"], appsOutDir: "dist/apps" }),
      ],
    });
    await server.listen();

    const content = fs.readFileSync(
      ".apollo-client-ai-apps/types/register.d.ts",
      "utf-8"
    );
    expect(content).toMatchInlineSnapshot(`
      "// This file is auto-generated by @apollo/client-ai-apps. Do not edit manually.
      import "@apollo/client-ai-apps";

      declare module "@apollo/client-ai-apps" {
        interface Register {
          toolName: "CreateTodo";
        }
      }"
    `);
  });
});

describe("html transforms", () => {
  test("replaces root relative scripts with full url when origin is provided", async () => {
    vol.fromJSON({
      "package.json": mockPackageJson(),
    });

    await using server = await setupServer({
      server: {
        origin: "http://localhost:3000",
      },
      plugins: [
        apolloClientAiApps({ targets: ["mcp"], appsOutDir: "dist/apps" }),
      ],
    });

    const html = `<html><head><script type="module" src="/@vite/client"></script></head><body><script module src="/assets/main.ts?t=12345"></script></body></html>`;
    const result = await server.transformIndexHtml("index.html", html);

    expect(result).toMatchInlineSnapshot(
      `
    "<html><head>
      <script type="module" src="http://localhost:3000/@vite/client"></script>
    <script type="module" src="http://localhost:3000/@vite/client"></script></head><body><script module src="http://localhost:3000/assets/main.ts?t=12345"></script></body></html>"
  `
    );
  });

  test("replaces root relative scripts with full url when origin is not provided", async () => {
    vol.fromJSON({
      "package.json": mockPackageJson(),
    });

    await using server = await setupServer({
      server: {
        port: 3000,
      },
      plugins: [
        apolloClientAiApps({ targets: ["mcp"], appsOutDir: "dist/apps" }),
      ],
    });

    await server.listen();

    const html = `<html><head>    <script type="module">import { injectIntoGlobalHook } from "/@react-refresh";
injectIntoGlobalHook(window);
window.$RefreshReg$ = () => {};
window.$RefreshSig$ = () => (type) => type;</script></head></html>`;

    const result = await server.transformIndexHtml("index.html", html);

    expect(result).toMatchInlineSnapshot(`
    "<html><head>
      <script type="module" src="http://localhost:3000/@vite/client"></script>
        <script type="module" src="http://localhost:3000/@id/__x00__index.html?html-proxy&index=0.js"></script></head></html>"
  `);
  });

  test("replaces root relative imports with full url when origin is provided", async () => {
    vol.fromJSON({
      "package.json": mockPackageJson(),
    });

    await using server = await setupServer({
      server: {
        origin: "http://localhost:3000",
      },
      plugins: [
        apolloClientAiApps({ targets: ["mcp"], appsOutDir: "dist/apps" }),
      ],
    });

    const html = `<html><head>    <script type="module">import { injectIntoGlobalHook } from "/@react-refresh";
injectIntoGlobalHook(window);
window.$RefreshReg$ = () => {};
window.$RefreshSig$ = () => (type) => type;</script></head></html>`;

    const result = await server.transformIndexHtml("index.html", html);

    expect(result).toMatchInlineSnapshot(`
    "<html><head>
      <script type="module" src="http://localhost:3000/@vite/client"></script>
        <script type="module" src="http://localhost:3000/@id/__x00__index.html?html-proxy&index=0.js"></script></head></html>"
  `);
  });

  test("replaces root relative imports with full url when origin is not provided", async () => {
    vol.fromJSON({
      "package.json": mockPackageJson(),
    });

    await using server = await setupServer({
      server: {
        port: 3000,
      },
      plugins: [
        apolloClientAiApps({ targets: ["mcp"], appsOutDir: "dist/apps" }),
      ],
    });

    await server.listen();

    const html = `<html><body><script module src="/assets/main.ts?t=12345"></script></body></html>`;

    const result = await server.transformIndexHtml("index.html", html);

    expect(result).toMatchInlineSnapshot(`
    "<html>
    <script type="module" src="http://localhost:3000/@vite/client"></script>
    <body><script module src="http://localhost:3000/assets/main.ts?t=12345"></script></body></html>"
  `);
  });

  test("does not prepend absolute urls when running a build instead of a local server", async () => {
    vol.fromJSON({
      "package.json": mockPackageJson(),
      "index.html": `<html><head></head><body><script type="module" src="/src/main.ts"></script></body></html>`,
      "src/main.ts": "export default {};",
    });

    let transformedHtml: string | undefined;

    await buildApp({
      build: { rollupOptions: { input: "index.html" } },
      server: {
        origin: "http://localhost:3000",
      },
      plugins: [
        apolloClientAiApps({ targets: ["mcp"], appsOutDir: "dist/apps" }),
        {
          name: "capture-html",
          transformIndexHtml: {
            order: "post",
            handler(html) {
              transformedHtml = html;
            },
          },
        },
      ],
    });

    expect(transformedHtml).toMatchInlineSnapshot(`
    "<html><head>  <script type="module" crossorigin src="/assets/index-B5Qt9EMX.js"></script>
    </head><body></body></html>"
  `);
  });
});

function declareOperation(operation: DocumentNode) {
  const name = getOperationName(operation, "MY_OPERATION");
  const varName = name.replace(/([a-z])([A-Z])/g, "$1_$2").toUpperCase();
  return `const ${varName} = gql\`\n${print(operation)}\n\``;
}

function declareFragment(fragment: DocumentNode) {
  const definition = getMainDefinition(fragment);
  invariant(
    definition.kind === Kind.FRAGMENT_DEFINITION,
    "declareFragment must receive a fragment definition"
  );

  const name = definition.name.value;
  const varName = name.replace(/([a-z])([A-Z])/g, "$1_$2").toUpperCase();
  return `const ${varName} = gql\`\n${print(fragment)}\n\``;
}

function mockPackageJson(config?: Record<string, unknown>) {
  return JSON.stringify({ version: "1.0.0", name: "my-app", ...config });
}

function readManifestFile(
  path = ".application-manifest.json"
): ApplicationManifest {
  const manifest = JSON.parse(fs.readFileSync(path, "utf-8"));

  // Use a deterministic hash for tests to ensure snapshots maintain a
  // consistent output
  manifest.hash = "abc";

  return manifest;
}

async function tmpWriteRealFile(filepath: string, contents: string) {
  vi.doUnmock("node:fs");
  const fs = await import("node:fs");

  fs.writeFileSync(filepath, contents);

  return {
    [Symbol.dispose]() {
      fs.rmSync(filepath);
    },
  } satisfies Disposable;
}

function interceptWriteESMtoCJS() {
  // Cosmiconfig's async loadTs transpiles .ts configs to ES2022 module syntax
  // and writes a .mjs file. In vitest, the subsequent import() transforms ESM to
  // CJS differently than Node's native loader, causing the default export to be
  // double-wrapped as { __esModule: true, default: actualConfig }. Converting to
  // CJS module.exports before the file is written ensures correct behavior.
  const origWriteFile = fs.promises.writeFile.bind(fs.promises);
  (fs.promises as any).writeFile = async function (
    filepath: any,
    content: any,
    ...args: any[]
  ) {
    if (
      typeof filepath === "string" &&
      filepath.endsWith(".mjs") &&
      typeof content === "string"
    ) {
      content = content.replace(/\bexport\s+default\s+/g, "module.exports = ");
    }
    return origWriteFile(filepath, content, ...args);
  };

  return {
    ...fs.promises,
    [Symbol.dispose]() {
      fs.promises.writeFile = origWriteFile;
    },
  };
}
