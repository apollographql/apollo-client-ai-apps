import { beforeEach, describe, expect, test, vi } from "vitest";
import fs from "node:fs";
import { gql, type DocumentNode } from "@apollo/client";
import { print } from "@apollo/client/utilities";
import { vol } from "memfs";
import { apolloClientAiApps } from "../apolloClientAiApps.js";
import { buildApp, setupServer } from "./utilities/build.js";
import type {
  ApplicationManifest,
  ManifestWidgetSettings,
} from "../../types/application-manifest.js";

vi.mock("node:fs");
vi.mock("node:fs/promises");

beforeEach(() => {
  vol.reset();
});

describe("buildStart", () => {
  test("Should write to dev application manifest file when using a serve command", async () => {
    vol.fromJSON({
      "package.json": JSON.stringify({
        labels: {
          toolInvocation: {
            invoking: "Testing global...",
            invoked: "Tested global!",
          },
        },
        widgetSettings: {
          description: "Test",
          domain: "https://example.com",
          prefersBorder: true,
        } satisfies ManifestWidgetSettings,
      }),
      "src/my-component.tsx": queryDeclaration(gql`
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
      plugins: [apolloClientAiApps({ targets: ["mcp"] })],
    });
    await server.listen();

    const manifest = readManifestFile();
    expect(manifest).toMatchInlineSnapshot(`
      {
        "csp": {
          "connectDomains": [],
          "frameDomains": [],
          "redirectDomains": [],
          "resourceDomains": [],
        },
        "format": "apollo-ai-app-manifest",
        "hash": "abc",
        "labels": {
          "toolInvocation/invoked": "Tested global!",
          "toolInvocation/invoking": "Testing global...",
        },
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

  test("Should NOT write to dev application manifest file when using a build command", async () => {
    vol.fromJSON({
      "package.json": JSON.stringify({}),
      "src/my-component.tsx": `
        const MY_QUERY = gql\`query HelloWorldQuery @tool(name: "hello-world", description: "This is an awesome tool!") { helloWorld }\`;
      `,
    });

    await buildApp({
      mode: "production",
      plugins: [apolloClientAiApps({ targets: ["mcp"] })],
    });

    const manifest = readManifestFile();
    expect(manifest.operations).toHaveLength(1);
    expect(manifest.operations[0].name).toBe("HelloWorldQuery");
  });

  test("Should not process files that do not contain gql tags", async () => {
    vol.fromJSON({
      "package.json": JSON.stringify({}),
      "src/my-component.tsx": `
        const MY_QUERY = \`query HelloWorldQuery @tool(name: "hello-world", description: "This is an awesome tool!") { helloWorld }\`;
      `,
    });

    await using server = await setupServer({
      plugins: [apolloClientAiApps({ targets: ["mcp"] })],
    });
    await server.listen();

    const manifest = readManifestFile();
    expect(manifest).toMatchInlineSnapshot(`
      {
        "csp": {
          "connectDomains": [],
          "frameDomains": [],
          "redirectDomains": [],
          "resourceDomains": [],
        },
        "format": "apollo-ai-app-manifest",
        "hash": "abc",
        "operations": [],
        "resource": "http://localhost:3333",
        "version": "1",
      }
    `);
  });

  test("Should capture queries when writing to manifest file", async () => {
    vol.fromJSON({
      "package.json": JSON.stringify({}),
      "src/my-component.tsx": `
        const MY_QUERY = gql\`query HelloWorldQuery { helloWorld }\`;
      `,
    });

    await using server = await setupServer({
      plugins: [apolloClientAiApps({ targets: ["mcp"] })],
    });
    await server.listen();

    const manifest = readManifestFile();
    expect(manifest).toMatchInlineSnapshot(`
      {
        "csp": {
          "connectDomains": [],
          "frameDomains": [],
          "redirectDomains": [],
          "resourceDomains": [],
        },
        "format": "apollo-ai-app-manifest",
        "hash": "abc",
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

  test("Should capture queries as prefetch when query is marked with @prefetch directive", async () => {
    vol.fromJSON({
      "package.json": JSON.stringify({}),
      "src/my-component.tsx": `
        const MY_QUERY = gql\`query HelloWorldQuery @prefetch { helloWorld }\`;
      `,
    });

    await using server = await setupServer({
      plugins: [apolloClientAiApps({ targets: ["mcp"] })],
    });
    await server.listen();

    const manifest = readManifestFile();
    expect(manifest).toMatchInlineSnapshot(`
      {
        "csp": {
          "connectDomains": [],
          "frameDomains": [],
          "redirectDomains": [],
          "resourceDomains": [],
        },
        "format": "apollo-ai-app-manifest",
        "hash": "abc",
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

  test("Should error when multiple operations are marked with @prefetch", async () => {
    vol.fromJSON({
      "package.json": JSON.stringify({}),
      "src/my-component.tsx": `
        const MY_QUERY = gql\`query HelloWorldQuery @prefetch { helloWorld }\`;
        const MY_QUERY2 = gql\`query HelloWorldQuery2 @prefetch { helloWorld }\`;
      `,
    });

    await expect(async () => {
      await using server = await setupServer({
        plugins: [apolloClientAiApps({ targets: ["mcp"] })],
      });
      await server.listen();
    }).rejects.toThrowErrorMatchingInlineSnapshot(
      `[Error: Found multiple operations marked as \`@prefetch\`. You can only mark 1 operation with \`@prefetch\`.]`
    );
  });

  test("Should capture mutations when writing to manifest file", async () => {
    vol.fromJSON({
      "package.json": JSON.stringify({}),
      "src/my-component.tsx": `
        const MY_QUERY = gql\`mutation HelloWorldQuery @tool(name: "hello-world", description: "This is an awesome tool!") { helloWorld }\`;
      `,
    });

    await using server = await setupServer({
      plugins: [apolloClientAiApps({ targets: ["mcp"] })],
    });
    await server.listen();

    const manifest = readManifestFile();
    expect(manifest).toMatchInlineSnapshot(`
      {
        "csp": {
          "connectDomains": [],
          "frameDomains": [],
          "redirectDomains": [],
          "resourceDomains": [],
        },
        "format": "apollo-ai-app-manifest",
        "hash": "abc",
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

  test("Should throw error when a subscription operation type is discovered", async () => {
    vol.fromJSON({
      "package.json": JSON.stringify({}),
      "src/my-component.tsx": `
        const MY_QUERY = gql\`subscription HelloWorldQuery @tool(name: "hello-world", description: "This is an awesome tool!") { helloWorld }\`;
      `,
    });

    await expect(async () => {
      await using server = await setupServer({
        plugins: [apolloClientAiApps({ targets: ["mcp"] })],
      });
      await server.listen();
    }).rejects.toThrowErrorMatchingInlineSnapshot(
      `[Error: Found an unsupported operation type. Only Query and Mutation are supported.]`
    );
  });

  test("Should use custom entry point when in serve mode and provided in package.json", async () => {
    vol.fromJSON({
      "package.json": JSON.stringify({
        entry: {
          staging: "http://staging.awesome.com",
        },
      }),
      "src/my-component.tsx": `
        const MY_QUERY = gql\`query HelloWorldQuery @tool(name: "hello-world", description: "This is an awesome tool!") { helloWorld }\`;
      `,
    });

    await using server = await setupServer({
      mode: "staging",
      plugins: [apolloClientAiApps({ targets: ["mcp"] })],
    });
    await server.listen();

    const manifest = readManifestFile();
    expect(manifest.resource).toBe("http://staging.awesome.com");
  });

  test("Should use https when enabled in server config", async () => {
    vol.fromJSON({
      "package.json": JSON.stringify({}),
      "src/my-component.tsx": `
        const MY_QUERY = gql\`query HelloWorldQuery @tool(name: "hello-world", description: "This is an awesome tool!") { helloWorld }\`;
      `,
    });

    await using server = await setupServer({
      server: { https: {}, port: 5678 },
      plugins: [apolloClientAiApps({ targets: ["mcp"] })],
    });
    await server.listen();

    const manifest = readManifestFile();
    expect(manifest.resource).toBe("https://localhost:5678");
  });

  test("Should use custom host when specified in server config", async () => {
    vol.fromJSON({
      "package.json": JSON.stringify({}),
      "src/my-component.tsx": `
        const MY_QUERY = gql\`query HelloWorldQuery @tool(name: "hello-world", description: "This is an awesome tool!") { helloWorld }\`;
      `,
    });

    await using server = await setupServer({
      server: { port: 5678, host: "0.0.0.0" },
      plugins: [apolloClientAiApps({ targets: ["mcp"] })],
    });
    await server.listen();

    const manifest = readManifestFile();
    expect(manifest.resource).toBe("http://0.0.0.0:5678");
  });

  test("Should error when tool name is not provided", async () => {
    vol.fromJSON({
      "package.json": JSON.stringify({}),
      "src/my-component.tsx": `
        const MY_QUERY = gql\`query HelloWorldQuery @tool { helloWorld }\`;
      `,
    });

    await expect(async () => {
      await using server = await setupServer({
        plugins: [apolloClientAiApps({ targets: ["mcp"] })],
      });
      await server.listen();
    }).rejects.toThrowErrorMatchingInlineSnapshot(
      `[Error: 'name' argument must be supplied for @tool]`
    );
  });

  test("Should error when tool description is not provided", async () => {
    vol.fromJSON({
      "package.json": JSON.stringify({}),
      "src/my-component.tsx": `
        const MY_QUERY = gql\`query HelloWorldQuery @tool(name: "hello-world") { helloWorld }\`;
      `,
    });

    await expect(async () => {
      await using server = await setupServer({
        plugins: [apolloClientAiApps({ targets: ["mcp"] })],
      });
      await server.listen();
    }).rejects.toThrowErrorMatchingInlineSnapshot(
      `[Error: 'description' argument must be supplied for @tool]`
    );
  });

  test("Should error when tool name contains spaces", async () => {
    vol.fromJSON({
      "package.json": JSON.stringify({}),
      "src/my-component.tsx": `
        const MY_QUERY = gql\`query HelloWorldQuery @tool(name: "hello world", description: "A tool") { helloWorld }\`;
      `,
    });

    await expect(async () => {
      await using server = await setupServer({
        plugins: [apolloClientAiApps({ targets: ["mcp"] })],
      });
      await server.listen();
    }).rejects.toThrowErrorMatchingInlineSnapshot(
      `[Error: Tool with name "hello world" contains spaces which is not allowed.]`
    );
  });

  test("Should error when tool name is not a string", async () => {
    vol.fromJSON({
      "package.json": JSON.stringify({}),
      "src/my-component.tsx": `
        const MY_QUERY = gql\`query HelloWorldQuery @tool(name: true) { helloWorld }\`;
      `,
    });

    await expect(async () => {
      await using server = await setupServer({
        plugins: [apolloClientAiApps({ targets: ["mcp"] })],
      });
      await server.listen();
    }).rejects.toThrowErrorMatchingInlineSnapshot(
      `[Error: Expected argument 'name' to be of type 'StringValue' but found 'BooleanValue' instead.]`
    );
  });

  test("Should error when tool description is not a string", async () => {
    vol.fromJSON({
      "package.json": JSON.stringify({}),
      "src/my-component.tsx": `
        const MY_QUERY = gql\`query HelloWorldQuery @tool(name: "hello-world", description: false) { helloWorld }\`;
      `,
    });

    await expect(async () => {
      await using server = await setupServer({
        plugins: [apolloClientAiApps({ targets: ["mcp"] })],
      });
      await server.listen();
    }).rejects.toThrowErrorMatchingInlineSnapshot(
      `[Error: Expected argument 'description' to be of type 'StringValue' but found 'BooleanValue' instead.]`
    );
  });

  test("Should error when extraInputs is not an array", async () => {
    vol.fromJSON({
      "package.json": JSON.stringify({}),
      "src/my-component.tsx": `
        const MY_QUERY = gql\`query HelloWorldQuery @tool(name: "hello-world", description: "hello", extraInputs: false ) { helloWorld }\`;
      `,
    });

    await expect(async () => {
      await using server = await setupServer({
        plugins: [apolloClientAiApps({ targets: ["mcp"] })],
      });
      await server.listen();
    }).rejects.toThrowErrorMatchingInlineSnapshot(
      `[Error: Expected argument 'extraInputs' to be of type 'ListValue' but found 'BooleanValue' instead.]`
    );
  });

  test("Should error when widgetSettings.prefersBorder is not a boolean", async () => {
    vol.fromJSON({
      "package.json": JSON.stringify({
        widgetSettings: {
          prefersBorder: "test",
        },
      }),
      "src/my-component.tsx": `
        const MY_QUERY = gql\`query HelloWorldQuery @tool(name: "test", description: "Test") { helloWorld }\`;
      `,
    });

    await expect(async () => {
      await using server = await setupServer({
        plugins: [apolloClientAiApps({ targets: ["mcp"] })],
      });
      await server.listen();
    }).rejects.toThrowErrorMatchingInlineSnapshot(
      `[Error: Expected 'widgetSettings.prefersBorder' to be of type 'boolean' but found 'string' instead.]`
    );
  });

  test("Should error when widgetSettings.description is not a string", async () => {
    vol.fromJSON({
      "package.json": JSON.stringify({
        widgetSettings: {
          description: true,
        },
      }),
      "src/my-component.tsx": `
        const MY_QUERY = gql\`query HelloWorldQuery @tool(name: "test", description: "Test") { helloWorld }\`;
      `,
    });

    await expect(async () => {
      await using server = await setupServer({
        plugins: [apolloClientAiApps({ targets: ["mcp"] })],
      });
      await server.listen();
    }).rejects.toThrowErrorMatchingInlineSnapshot(
      `[Error: Expected 'widgetSettings.description' to be of type 'string' but found 'boolean' instead.]`
    );
  });

  test("Should error when widgetSettings.domain is not a string", async () => {
    vol.fromJSON({
      "package.json": JSON.stringify({
        widgetSettings: {
          domain: true,
        },
      }),
      "src/my-component.tsx": `
        const MY_QUERY = gql\`query HelloWorldQuery @tool(name: "test", description: "Test") { helloWorld }\`;
      `,
    });

    await expect(async () => {
      await using server = await setupServer({
        plugins: [apolloClientAiApps({ targets: ["mcp"] })],
      });
      await server.listen();
    }).rejects.toThrowErrorMatchingInlineSnapshot(
      `[Error: Expected 'widgetSettings.domain' to be of type 'string' but found 'boolean' instead.]`
    );
  });

  test("Should allow empty widgetSettings value", async () => {
    vol.fromJSON({
      "package.json": JSON.stringify({
        widgetSettings: {},
      }),
      "src/my-component.tsx": `
        const MY_QUERY = gql\`query HelloWorldQuery @tool(name: "test", description: "Test") { helloWorld }\`;
      `,
    });

    await using server = await setupServer({
      plugins: [apolloClientAiApps({ targets: ["mcp"] })],
    });
    await server.listen();

    const manifest = readManifestFile();
    expect(manifest.operations).toHaveLength(1);
  });

  test("Should error when labels.toolInvocation.invoking in package.json is not a string", async () => {
    vol.fromJSON({
      "package.json": JSON.stringify({
        labels: {
          toolInvocation: {
            invoking: true,
          },
        },
      }),
      "src/my-component.tsx": `
        const MY_QUERY = gql\`query HelloWorldQuery @tool(name: "test", description: "Test") { helloWorld }\`;
      `,
    });

    await expect(async () => {
      await using server = await setupServer({
        plugins: [apolloClientAiApps({ targets: ["mcp"] })],
      });
      await server.listen();
    }).rejects.toThrowErrorMatchingInlineSnapshot(
      `[Error: Expected 'labels.toolInvocation.invoking' to be of type 'string' but found 'boolean' instead.]`
    );
  });

  test("Should error when labels.toolInvocation.invoking in @tool is not a string", async () => {
    vol.fromJSON({
      "package.json": JSON.stringify({}),
      "src/my-component.tsx": `
        const MY_QUERY = gql\`query HelloWorldQuery @tool(name: "test", description: "Test", labels: { toolInvocation: { invoking: true } }) { helloWorld }\`;
      `,
    });

    await expect(async () => {
      await using server = await setupServer({
        plugins: [apolloClientAiApps({ targets: ["mcp"] })],
      });
      await server.listen();
    }).rejects.toThrowErrorMatchingInlineSnapshot(
      `[Error: Expected 'labels.toolInvocation.invoking' to be of type 'string' but found 'boolean' instead.]`
    );
  });

  test("Should error when labels.toolInvocation.invoked in package.json is not a string", async () => {
    vol.fromJSON({
      "package.json": JSON.stringify({
        labels: {
          toolInvocation: {
            invoked: true,
          },
        },
      }),
      "src/my-component.tsx": `
        const MY_QUERY = gql\`query HelloWorldQuery @tool(name: "test", description: "Test") { helloWorld }\`;
      `,
    });

    await expect(async () => {
      await using server = await setupServer({
        plugins: [apolloClientAiApps({ targets: ["mcp"] })],
      });
      await server.listen();
    }).rejects.toThrowErrorMatchingInlineSnapshot(
      `[Error: Expected 'labels.toolInvocation.invoked' to be of type 'string' but found 'boolean' instead.]`
    );
  });

  test("Should error when labels.toolInvocation.invoked in @tool is not a string", async () => {
    vol.fromJSON({
      "package.json": JSON.stringify({}),
      "src/my-component.tsx": `
        const MY_QUERY = gql\`query HelloWorldQuery @tool(name: "test", description: "Test", labels: { toolInvocation: { invoked: true } }) { helloWorld }\`;
      `,
    });

    await expect(async () => {
      await using server = await setupServer({
        plugins: [apolloClientAiApps({ targets: ["mcp"] })],
      });
      await server.listen();
    }).rejects.toThrowErrorMatchingInlineSnapshot(
      `[Error: Expected 'labels.toolInvocation.invoked' to be of type 'string' but found 'boolean' instead.]`
    );
  });

  test("Should allow empty labels value", async () => {
    vol.fromJSON({
      "package.json": JSON.stringify({
        labels: {},
      }),
      "src/my-component.tsx": `
        const MY_QUERY = gql\`query HelloWorldQuery @tool(name: "test", description: "Test", labels: {}) { helloWorld }\`;
      `,
    });

    await using server = await setupServer({
      plugins: [apolloClientAiApps({ targets: ["mcp"] })],
    });
    await server.listen();

    const manifest = readManifestFile();
    expect(manifest.operations).toHaveLength(1);
  });

  test("Should error when an unknown type is discovered", async () => {
    vol.fromJSON({
      "package.json": JSON.stringify({}),
      "src/my-component.tsx": `
        const MY_QUERY = gql\`query HelloWorldQuery @tool(name: "hello-world", description: "hello", extraInputs: [{
          name: 3.1
        }] ) { helloWorld }\`;
      `,
    });

    await expect(async () => {
      await using server = await setupServer({
        plugins: [apolloClientAiApps({ targets: ["mcp"] })],
      });
      await server.listen();
    }).rejects.toThrowErrorMatchingInlineSnapshot(
      `[Error: Error when parsing directive values: unexpected type 'FloatValue']`
    );
  });

  test("Should order operations and fragments when generating normalized operation", async () => {
    vol.fromJSON({
      "package.json": JSON.stringify({}),
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
      plugins: [apolloClientAiApps({ targets: ["mcp"] })],
    });
    await server.listen();

    const manifest = readManifestFile();
    expect(manifest).toMatchInlineSnapshot(`
      {
        "csp": {
          "connectDomains": [],
          "frameDomains": [],
          "redirectDomains": [],
          "resourceDomains": [],
        },
        "format": "apollo-ai-app-manifest",
        "hash": "abc",
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

describe("writeBundle", () => {
  test("Should use custom entry point when in build mode and provided in package.json", async () => {
    vol.fromJSON({
      "package.json": JSON.stringify({
        entry: {
          staging: "http://staging.awesome.com",
        },
      }),
      "src/my-component.tsx": `
        const MY_QUERY = gql\`query HelloWorldQuery @tool(name: "hello-world", description: "This is an awesome tool!") { helloWorld }\`;
      `,
    });

    await buildApp({
      mode: "staging",
      plugins: [apolloClientAiApps({ targets: ["mcp"] })],
    });

    const manifest = readManifestFile();
    expect(manifest.resource).toBe("http://staging.awesome.com");
  });

  test("Should use index.html when in build production and not provided in package.json", async () => {
    vol.fromJSON({
      "package.json": JSON.stringify({}),
      "src/my-component.tsx": `
        const MY_QUERY = gql\`query HelloWorldQuery @tool(name: "hello-world", description: "This is an awesome tool!") { helloWorld }\`;
      `,
    });

    await buildApp({
      mode: "production",
      plugins: [apolloClientAiApps({ targets: ["mcp"] })],
    });

    const manifest = readManifestFile();
    expect(manifest.resource).toBe("index.html");
  });

  test("Should throw an error when in build mode and using a mode that is not production and not provided in package.json", async () => {
    vol.fromJSON({
      "package.json": JSON.stringify({}),
      "src/my-component.tsx": `
        const MY_QUERY = gql\`query HelloWorldQuery @tool(name: "hello-world", description: "This is an awesome tool!") { helloWorld }\`;
      `,
    });

    await expect(
      async () =>
        await buildApp({
          mode: "staging",
          plugins: [apolloClientAiApps({ targets: ["mcp"] })],
        })
    ).rejects.toThrowError(
      `[OperationManifest] No entry point found for mode "staging". Entry points other than "development" and "production" must be defined in package.json file.`
    );
  });

  test("Should always write to both locations when running in build mode", async () => {
    vol.fromJSON({
      "package.json": JSON.stringify({}),
      "src/my-component.tsx": `
        const MY_QUERY = gql\`query HelloWorldQuery @tool(name: "hello-world", description: "This is an awesome tool!") { helloWorld }\`;
      `,
    });

    await buildApp({
      mode: "production",
      plugins: [apolloClientAiApps({ targets: ["mcp"] })],
    });

    expect(vol.existsSync(".application-manifest.json")).toBe(true);
    expect(vol.existsSync("dist/.application-manifest.json")).toBe(true);
  });
});

describe("configureServer", () => {
  test("Should write to manifest file when package.json or file is updated", async () => {
    vol.fromJSON({
      "package.json": JSON.stringify({}),
      "src/my-component.tsx": `
        const MY_QUERY = gql\`query HelloWorldQuery($name: string!) @tool(name: "hello-world", description: "This is an awesome tool!", extraInputs: [{
          name: "doStuff",
          type: "boolean",
          description: "Should we do stuff?"
        }]) { helloWorld(name: $name) }\`;
      `,
    });

    await using server = await setupServer({
      plugins: [apolloClientAiApps({ targets: ["mcp"] })],
    });
    await server.listen();

    const manifestBefore = readManifestFile();
    expect(manifestBefore.operations).toHaveLength(1);

    vol.writeFileSync(
      "src/my-component.tsx",
      `
        const MY_QUERY = gql\`query UpdatedQuery($name: string!) @tool(name: "updated-tool", description: "Updated tool!") { updatedWorld(name: $name) }\`;
      `
    );

    server.watcher.emit("change", process.cwd() + "/src/my-component.tsx");

    // Allow async handlers to complete
    await new Promise((resolve) => setTimeout(resolve, 100));

    const manifestAfter = readManifestFile();
    expect(manifestAfter.operations).toHaveLength(1);
    expect(manifestAfter.operations[0].name).toBe("UpdatedQuery");
  });
});

describe("html transforms", () => {
  test("replaces root relative scripts with full url when origin is provided", async () => {
    vol.fromJSON({
      "package.json": JSON.stringify({}),
    });

    await using server = await setupServer({
      server: {
        origin: "http://localhost:3000",
      },
      plugins: [apolloClientAiApps({ targets: ["mcp"] })],
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
      "package.json": JSON.stringify({}),
    });

    await using server = await setupServer({
      server: {
        port: 3000,
      },
      plugins: [apolloClientAiApps({ targets: ["mcp"] })],
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
      "package.json": JSON.stringify({}),
    });

    await using server = await setupServer({
      server: {
        origin: "http://localhost:3000",
      },
      plugins: [apolloClientAiApps({ targets: ["mcp"] })],
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
      "package.json": JSON.stringify({}),
    });

    await using server = await setupServer({
      server: {
        port: 3000,
      },
      plugins: [apolloClientAiApps({ targets: ["mcp"] })],
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
      "package.json": JSON.stringify({}),
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
        apolloClientAiApps({ targets: ["mcp"] }),
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

function queryDeclaration(query: DocumentNode) {
  return `const MY_QUERY = gql\`\n${print(query)}\n\``;
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
