import type { Mock } from "vitest";
import { expect, test, vi, describe, beforeEach } from "vitest";
import { ApplicationManifestPlugin } from "../application_manifest_plugin.js";
import fs from "fs";
import * as glob from "glob";
import path from "path";
import type { ManifestWidgetSettings } from "../../types/application-manifest.js";

const root = process.cwd();

vi.mock(import("fs"), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    default: {
      ...actual.default,
      readFileSync: vi.fn(),
      writeFileSync: vi.fn(),
      mkdirSync: vi.fn(),
    },
  };
});

vi.mock(import("path"), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    default: {
      ...actual.default,
      resolve: vi.fn((...args) =>
        args.map((a, i) => (i === 0 ? a : a.replace(/^\//, ""))).join("/")
      ),
      dirname: vi.fn(),
    },
  };
});

vi.mock(import("glob"));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("buildStart", () => {
  test("Should write to dev application manifest file when using a serve command", async () => {
    mockReadFile({
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
      [`${root}/my-component.tsx`]: `
const MY_QUERY = gql\`query HelloWorldQuery($name: string!) @tool(
  name: "hello-world",
  description: "This is an awesome tool!",
  extraInputs: [{
    name: "doStuff",
    type: "boolean",
    description: "Should we do stuff?"
  }],
  labels: {
    toolInvocation: {
      invoking: "Testing tool...",
      invoked: "Tested tool!"
    }
  }
) { helloWorld(name: $name) }\`;
      `,
    });

    vi.spyOn(glob, "glob").mockImplementation(() =>
      Promise.resolve(["my-component.tsx"])
    );
    vi.spyOn(fs, "writeFileSync");

    const plugin = ApplicationManifestPlugin();
    plugin.configResolved({
      command: "serve",
      server: {},
      build: { outDir: "/dist" },
    });
    await plugin.buildStart();
    let [file, content] = (fs.writeFileSync as unknown as Mock).mock.calls[0];

    // Ignore the hash so we can do a snapshot that doesn't constantly change
    let contentObj = JSON.parse(content);
    contentObj.hash = "abc";

    expect(fs.writeFileSync).toHaveBeenCalledTimes(2);
    expect(file).toBe(root + "/dist/.application-manifest.json");
    expect(contentObj).toMatchInlineSnapshot(`
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
        "resource": "http://localhost:undefined",
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
    mockReadFile({
      "package.json": JSON.stringify({}),
      "my-component.tsx": `
        const MY_QUERY = gql\`query HelloWorldQuery @tool(name: "hello-world", description: "This is an awesome tool!") { helloWorld }\`;
      `,
    });
    vi.spyOn(glob, "glob").mockImplementation(() =>
      Promise.resolve(["my-component.tsx"])
    );
    vi.spyOn(path, "resolve").mockImplementation((_, file) => file);
    vi.spyOn(fs, "writeFileSync");

    const plugin = ApplicationManifestPlugin();
    plugin.configResolved({ command: "build", server: {} });
    await plugin.buildStart();

    expect(fs.writeFileSync).not.toHaveBeenCalled();
  });

  test("Should not process files that do not contain gql tags", async () => {
    mockReadFile({
      "package.json": JSON.stringify({}),
      [`${root}/my-component.tsx`]: `
        const MY_QUERY = \`query HelloWorldQuery @tool(name: "hello-world", description: "This is an awesome tool!") { helloWorld }\`;
      `,
    });
    vi.spyOn(glob, "glob").mockImplementation(() =>
      Promise.resolve(["my-component.tsx"])
    );
    vi.spyOn(fs, "writeFileSync");

    const plugin = ApplicationManifestPlugin();
    plugin.configResolved({
      command: "serve",
      server: {},
      build: { outDir: "/dist" },
    });
    await plugin.buildStart();
    let [file, content] = (fs.writeFileSync as unknown as Mock).mock.calls[0];

    // Ignore the hash so we can do a snapshot that doesn't constantly change
    let contentObj = JSON.parse(content);
    contentObj.hash = "abc";

    expect(fs.writeFileSync).toHaveBeenCalledTimes(2);
    expect(file).toBe(root + "/dist/.application-manifest.json");
    expect(contentObj).toMatchInlineSnapshot(`
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
        "resource": "http://localhost:undefined",
        "version": "1",
      }
    `);
  });

  test("Should capture queries when writing to manifest file", async () => {
    mockReadFile({
      "package.json": JSON.stringify({}),
      [`${root}/my-component.tsx`]: `
        const MY_QUERY = gql\`query HelloWorldQuery { helloWorld }\`;
      `,
    });
    vi.spyOn(glob, "glob").mockImplementation(() =>
      Promise.resolve(["my-component.tsx"])
    );
    vi.spyOn(fs, "writeFileSync");

    const plugin = ApplicationManifestPlugin();
    plugin.configResolved({
      command: "serve",
      server: {},
      build: { outDir: "/dist" },
    });
    await plugin.buildStart();
    let [file, content] = (fs.writeFileSync as unknown as Mock).mock.calls[0];

    // Ignore the hash so we can do a snapshot that doesn't constantly change
    let contentObj = JSON.parse(content);
    contentObj.hash = "abc";

    expect(fs.writeFileSync).toHaveBeenCalledTimes(2);
    expect(file).toBe(root + "/dist/.application-manifest.json");
    expect(contentObj).toMatchInlineSnapshot(`
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
        "resource": "http://localhost:undefined",
        "version": "1",
      }
    `);
  });

  test("Should capture queries as prefetch when query is marked with @prefetch directive", async () => {
    mockReadFile({
      "package.json": JSON.stringify({}),
      [`${root}/my-component.tsx`]: `
        const MY_QUERY = gql\`query HelloWorldQuery @prefetch { helloWorld }\`;
      `,
    });
    vi.spyOn(glob, "glob").mockImplementation(() =>
      Promise.resolve(["my-component.tsx"])
    );
    vi.spyOn(fs, "writeFileSync");

    const plugin = ApplicationManifestPlugin();
    plugin.configResolved({
      command: "serve",
      server: {},
      build: { outDir: "/dist" },
    });
    await plugin.buildStart();
    let [file, content] = (fs.writeFileSync as unknown as Mock).mock.calls[0];

    // Ignore the hash so we can do a snapshot that doesn't constantly change
    let contentObj = JSON.parse(content);
    contentObj.hash = "abc";

    expect(fs.writeFileSync).toHaveBeenCalledTimes(2);
    expect(file).toBe(root + "/dist/.application-manifest.json");
    expect(contentObj).toMatchInlineSnapshot(`
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
        "resource": "http://localhost:undefined",
        "version": "1",
      }
    `);
  });

  test("Should error when multiple operations are marked with @prefetch", async () => {
    mockReadFile({
      "package.json": JSON.stringify({}),
      "my-component.tsx": `
        const MY_QUERY = gql\`query HelloWorldQuery @prefetch { helloWorld }\`;
        const MY_QUERY2 = gql\`query HelloWorldQuery2 @prefetch { helloWorld }\`;
      `,
    });
    vi.spyOn(glob, "glob").mockImplementation(() =>
      Promise.resolve(["my-component.tsx"])
    );
    vi.spyOn(path, "resolve").mockImplementation((_, file) => file);
    vi.spyOn(fs, "writeFileSync");

    const plugin = ApplicationManifestPlugin();
    plugin.configResolved({ command: "serve", server: {} });
    await expect(
      async () => await plugin.buildStart()
    ).rejects.toThrowErrorMatchingInlineSnapshot(
      `[Error: Found multiple operations marked as \`@prefetch\`. You can only mark 1 operation with \`@prefetch\`.]`
    );
  });

  test("Should capture mutations when writing to manifest file", async () => {
    mockReadFile({
      "package.json": JSON.stringify({}),
      [`${root}/my-component.tsx`]: `
        const MY_QUERY = gql\`mutation HelloWorldQuery @tool(name: "hello-world", description: "This is an awesome tool!") { helloWorld }\`;
      `,
    });
    vi.spyOn(glob, "glob").mockImplementation(() =>
      Promise.resolve(["my-component.tsx"])
    );
    vi.spyOn(fs, "writeFileSync");

    const plugin = ApplicationManifestPlugin();
    plugin.configResolved({
      command: "serve",
      server: {},
      build: { outDir: "/dist" },
    });
    await plugin.buildStart();
    let [file, content] = (fs.writeFileSync as unknown as Mock).mock.calls[0];

    // Ignore the hash so we can do a snapshot that doesn't constantly change
    let contentObj = JSON.parse(content);
    contentObj.hash = "abc";

    expect(fs.writeFileSync).toHaveBeenCalledTimes(2);
    expect(file).toBe(root + "/dist/.application-manifest.json");
    expect(contentObj).toMatchInlineSnapshot(`
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
        "resource": "http://localhost:undefined",
        "version": "1",
      }
    `);
  });

  test("Should throw error when a subscription operation type is discovered", async () => {
    mockReadFile({
      "package.json": JSON.stringify({}),
      "my-component.tsx": `
        const MY_QUERY = gql\`subscription HelloWorldQuery @tool(name: "hello-world", description: "This is an awesome tool!") { helloWorld }\`;
      `,
    });
    vi.spyOn(glob, "glob").mockImplementation(() =>
      Promise.resolve(["my-component.tsx"])
    );
    vi.spyOn(path, "resolve").mockImplementation((_, file) => file);
    vi.spyOn(fs, "writeFileSync");

    const plugin = ApplicationManifestPlugin();
    plugin.configResolved({ command: "serve", server: {} });

    await expect(
      async () => await plugin.buildStart()
    ).rejects.toThrowErrorMatchingInlineSnapshot(
      `[Error: Found an unsupported operation type. Only Query and Mutation are supported.]`
    );
  });

  test("Should use custom entry point when in serve mode and provided in package.json", async () => {
    mockReadFile({
      "package.json": JSON.stringify({
        entry: {
          staging: "http://staging.awesome.com",
        },
      }),
      "my-component.tsx": `
        const MY_QUERY = gql\`query HelloWorldQuery @tool(name: "hello-world", description: "This is an awesome tool!") { helloWorld }\`;
      `,
    });
    vi.spyOn(glob, "glob").mockImplementation(() =>
      Promise.resolve(["my-component.tsx"])
    );
    vi.spyOn(path, "resolve").mockImplementation((_, file) => file);
    vi.spyOn(fs, "writeFileSync");

    const plugin = ApplicationManifestPlugin();
    plugin.configResolved({
      command: "serve",
      mode: "staging",
      server: {},
      build: { outDir: "/dist" },
    });
    await plugin.buildStart();

    let [, content] = (fs.writeFileSync as unknown as Mock).mock.calls[0];
    let contentObj = JSON.parse(content);

    expect(contentObj.resource).toBe("http://staging.awesome.com");
  });

  test("Should use https when enabled in server config", async () => {
    mockReadFile({
      "package.json": JSON.stringify({}),
      "my-component.tsx": `
        const MY_QUERY = gql\`query HelloWorldQuery @tool(name: "hello-world", description: "This is an awesome tool!") { helloWorld }\`;
      `,
    });
    vi.spyOn(glob, "glob").mockImplementation(() =>
      Promise.resolve(["my-component.tsx"])
    );
    vi.spyOn(path, "resolve").mockImplementation((_, file) => file);
    vi.spyOn(fs, "writeFileSync");

    const plugin = ApplicationManifestPlugin();
    plugin.configResolved({
      command: "serve",
      server: { https: {}, port: "5678" },
      build: { outDir: "/dist" },
    });
    await plugin.buildStart();

    let [, content] = (fs.writeFileSync as unknown as Mock).mock.calls[0];
    let contentObj = JSON.parse(content);

    expect(contentObj.resource).toBe("https://localhost:5678");
  });

  test("Should use custom host when specified in server config", async () => {
    mockReadFile({
      "package.json": JSON.stringify({}),
      "my-component.tsx": `
        const MY_QUERY = gql\`query HelloWorldQuery @tool(name: "hello-world", description: "This is an awesome tool!") { helloWorld }\`;
      `,
    });
    vi.spyOn(glob, "glob").mockImplementation(() =>
      Promise.resolve(["my-component.tsx"])
    );
    vi.spyOn(path, "resolve").mockImplementation((_, file) => file);
    vi.spyOn(fs, "writeFileSync");

    const plugin = ApplicationManifestPlugin();
    plugin.configResolved({
      command: "serve",
      server: { port: "5678", host: "awesome.com" },
      build: { outDir: "/dist" },
    });
    await plugin.buildStart();

    let [, content] = (fs.writeFileSync as unknown as Mock).mock.calls[0];
    let contentObj = JSON.parse(content);

    expect(contentObj.resource).toBe("http://awesome.com:5678");
  });

  test("Should error when tool name is not provided", async () => {
    mockReadFile({
      "package.json": JSON.stringify({}),
      "my-component.tsx": `
        const MY_QUERY = gql\`query HelloWorldQuery @tool { helloWorld }\`;
      `,
    });
    vi.spyOn(glob, "glob").mockImplementation(() =>
      Promise.resolve(["my-component.tsx"])
    );
    vi.spyOn(path, "resolve").mockImplementation((_, file) => file);
    vi.spyOn(fs, "writeFileSync");

    const plugin = ApplicationManifestPlugin();
    plugin.configResolved({ command: "serve", server: {} });

    await expect(
      async () => await plugin.buildStart()
    ).rejects.toThrowErrorMatchingInlineSnapshot(
      `[Error: 'name' argument must be supplied for @tool]`
    );
  });

  test("Should error when tool description is not provided", async () => {
    mockReadFile({
      "package.json": JSON.stringify({}),
      "my-component.tsx": `
        const MY_QUERY = gql\`query HelloWorldQuery @tool(name: "hello-world") { helloWorld }\`;
      `,
    });
    vi.spyOn(glob, "glob").mockImplementation(() =>
      Promise.resolve(["my-component.tsx"])
    );
    vi.spyOn(path, "resolve").mockImplementation((_, file) => file);
    vi.spyOn(fs, "writeFileSync");

    const plugin = ApplicationManifestPlugin();
    plugin.configResolved({ command: "serve", server: {} });

    await expect(
      async () => await plugin.buildStart()
    ).rejects.toThrowErrorMatchingInlineSnapshot(
      `[Error: 'description' argument must be supplied for @tool]`
    );
  });

  test("Should error when tool name contains spaces", async () => {
    mockReadFile({
      "package.json": JSON.stringify({}),
      "my-component.tsx": `
        const MY_QUERY = gql\`query HelloWorldQuery @tool(name: "hello world", description: "A tool") { helloWorld }\`;
      `,
    });
    vi.spyOn(glob, "glob").mockImplementation(() =>
      Promise.resolve(["my-component.tsx"])
    );
    vi.spyOn(path, "resolve").mockImplementation((_, file) => file);
    vi.spyOn(fs, "writeFileSync");

    const plugin = ApplicationManifestPlugin();
    plugin.configResolved({ command: "serve", server: {} });

    await expect(
      async () => await plugin.buildStart()
    ).rejects.toThrowErrorMatchingInlineSnapshot(
      `[Error: Tool with name "hello world" contains spaces which is not allowed.]`
    );
  });

  test("Should error when tool name is not a string", async () => {
    mockReadFile({
      "package.json": JSON.stringify({}),
      "my-component.tsx": `
        const MY_QUERY = gql\`query HelloWorldQuery @tool(name: true) { helloWorld }\`;
      `,
    });
    vi.spyOn(glob, "glob").mockImplementation(() =>
      Promise.resolve(["my-component.tsx"])
    );
    vi.spyOn(path, "resolve").mockImplementation((_, file) => file);
    vi.spyOn(fs, "writeFileSync");

    const plugin = ApplicationManifestPlugin();
    plugin.configResolved({ command: "serve", server: {} });

    await expect(
      async () => await plugin.buildStart()
    ).rejects.toThrowErrorMatchingInlineSnapshot(
      `[Error: Expected argument 'name' to be of type 'StringValue' but found 'BooleanValue' instead.]`
    );
  });

  test("Should error when tool description is not a string", async () => {
    mockReadFile({
      "package.json": JSON.stringify({}),
      "my-component.tsx": `
        const MY_QUERY = gql\`query HelloWorldQuery @tool(name: "hello-world", description: false) { helloWorld }\`;
      `,
    });
    vi.spyOn(glob, "glob").mockImplementation(() =>
      Promise.resolve(["my-component.tsx"])
    );
    vi.spyOn(path, "resolve").mockImplementation((_, file) => file);
    vi.spyOn(fs, "writeFileSync");

    const plugin = ApplicationManifestPlugin();
    plugin.configResolved({ command: "serve", server: {} });

    await expect(
      async () => await plugin.buildStart()
    ).rejects.toThrowErrorMatchingInlineSnapshot(
      `[Error: Expected argument 'description' to be of type 'StringValue' but found 'BooleanValue' instead.]`
    );
  });

  test("Should error when extraInputs is not an array", async () => {
    mockReadFile({
      "package.json": JSON.stringify({}),
      "my-component.tsx": `
        const MY_QUERY = gql\`query HelloWorldQuery @tool(name: "hello-world", description: "hello", extraInputs: false ) { helloWorld }\`;
      `,
    });
    vi.spyOn(glob, "glob").mockImplementation(() =>
      Promise.resolve(["my-component.tsx"])
    );
    vi.spyOn(path, "resolve").mockImplementation((_, file) => file);
    vi.spyOn(fs, "writeFileSync");

    const plugin = ApplicationManifestPlugin();
    plugin.configResolved({ command: "serve", server: {} });

    await expect(
      async () => await plugin.buildStart()
    ).rejects.toThrowErrorMatchingInlineSnapshot(
      `[Error: Expected argument 'extraInputs' to be of type 'ListValue' but found 'BooleanValue' instead.]`
    );
  });

  test("Should error when widgetSettings.prefersBorder is not a boolean", async () => {
    mockReadFile({
      "package.json": JSON.stringify({
        widgetSettings: {
          prefersBorder: "test",
        },
      }),
      "my-component.tsx": `
        const MY_QUERY = gql\`query HelloWorldQuery @tool(name: "test", description: "Test") { helloWorld }\`;
      `,
    });
    vi.spyOn(glob, "glob").mockImplementation(() =>
      Promise.resolve(["my-component.tsx"])
    );
    vi.spyOn(path, "resolve").mockImplementation((_, file) => file);
    vi.spyOn(fs, "writeFileSync");

    const plugin = ApplicationManifestPlugin();
    plugin.configResolved({ command: "serve", server: {} });

    await expect(
      async () => await plugin.buildStart()
    ).rejects.toThrowErrorMatchingInlineSnapshot(
      `[Error: Expected 'widgetSettings.prefersBorder' to be of type 'boolean' but found 'string' instead.]`
    );
  });

  test("Should error when widgetSettings.description is not a string", async () => {
    mockReadFile({
      "package.json": JSON.stringify({
        widgetSettings: {
          description: true,
        },
      }),
      "my-component.tsx": `
        const MY_QUERY = gql\`query HelloWorldQuery @tool(name: "test", description: "Test") { helloWorld }\`;
      `,
    });
    vi.spyOn(glob, "glob").mockImplementation(() =>
      Promise.resolve(["my-component.tsx"])
    );
    vi.spyOn(path, "resolve").mockImplementation((_, file) => file);
    vi.spyOn(fs, "writeFileSync");

    const plugin = ApplicationManifestPlugin();
    plugin.configResolved({ command: "serve", server: {} });

    await expect(
      async () => await plugin.buildStart()
    ).rejects.toThrowErrorMatchingInlineSnapshot(
      `[Error: Expected 'widgetSettings.description' to be of type 'string' but found 'boolean' instead.]`
    );
  });

  test("Should error when widgetSettings.domain is not a string", async () => {
    mockReadFile({
      "package.json": JSON.stringify({
        widgetSettings: {
          domain: true,
        },
      }),
      "my-component.tsx": `
        const MY_QUERY = gql\`query HelloWorldQuery @tool(name: "test", description: "Test") { helloWorld }\`;
      `,
    });
    vi.spyOn(glob, "glob").mockImplementation(() =>
      Promise.resolve(["my-component.tsx"])
    );
    vi.spyOn(path, "resolve").mockImplementation((_, file) => file);
    vi.spyOn(fs, "writeFileSync");

    const plugin = ApplicationManifestPlugin();
    plugin.configResolved({ command: "serve", server: {} });

    await expect(
      async () => await plugin.buildStart()
    ).rejects.toThrowErrorMatchingInlineSnapshot(
      `[Error: Expected 'widgetSettings.domain' to be of type 'string' but found 'boolean' instead.]`
    );
  });

  test("Should allow empty widgetSettings value", async () => {
    mockReadFile({
      "package.json": JSON.stringify({
        widgetSettings: {},
      }),
      "my-component.tsx": `
        const MY_QUERY = gql\`query HelloWorldQuery @tool(name: "test", description: "Test") { helloWorld }\`;
      `,
    });
    vi.spyOn(glob, "glob").mockImplementation(() =>
      Promise.resolve(["my-component.tsx"])
    );
    vi.spyOn(path, "resolve").mockImplementation((_, file) => file);
    vi.spyOn(fs, "writeFileSync");

    const plugin = ApplicationManifestPlugin();
    plugin.configResolved({ command: "serve", server: {}, build: {} });

    await expect(plugin.buildStart()).resolves.toBeUndefined();
  });

  test("Should error when labels.toolInvocation.invoking in package.json is not a string", async () => {
    mockReadFile({
      "package.json": JSON.stringify({
        labels: {
          toolInvocation: {
            invoking: true,
          },
        },
      }),
      "my-component.tsx": `
        const MY_QUERY = gql\`query HelloWorldQuery @tool(name: "test", description: "Test") { helloWorld }\`;
      `,
    });
    vi.spyOn(glob, "glob").mockImplementation(() =>
      Promise.resolve(["my-component.tsx"])
    );
    vi.spyOn(path, "resolve").mockImplementation((_, file) => file);
    vi.spyOn(fs, "writeFileSync");

    const plugin = ApplicationManifestPlugin();
    plugin.configResolved({ command: "serve", server: {} });

    await expect(
      async () => await plugin.buildStart()
    ).rejects.toThrowErrorMatchingInlineSnapshot(
      `[Error: Expected 'labels.toolInvocation.invoking' to be of type 'string' but found 'boolean' instead.]`
    );
  });

  test("Should error when labels.toolInvocation.invoking in @tool is not a string", async () => {
    mockReadFile({
      "package.json": JSON.stringify({}),
      "my-component.tsx": `
        const MY_QUERY = gql\`query HelloWorldQuery @tool(name: "test", description: "Test", labels: { toolInvocation: { invoking: true } }) { helloWorld }\`;
      `,
    });
    vi.spyOn(glob, "glob").mockImplementation(() =>
      Promise.resolve(["my-component.tsx"])
    );
    vi.spyOn(path, "resolve").mockImplementation((_, file) => file);
    vi.spyOn(fs, "writeFileSync");

    const plugin = ApplicationManifestPlugin();
    plugin.configResolved({ command: "serve", server: {} });

    await expect(
      async () => await plugin.buildStart()
    ).rejects.toThrowErrorMatchingInlineSnapshot(
      `[Error: Expected 'labels.toolInvocation.invoking' to be of type 'string' but found 'boolean' instead.]`
    );
  });

  test("Should error when labels.toolInvocation.invoked in package.json is not a string", async () => {
    mockReadFile({
      "package.json": JSON.stringify({
        labels: {
          toolInvocation: {
            invoked: true,
          },
        },
      }),
      "my-component.tsx": `
        const MY_QUERY = gql\`query HelloWorldQuery @tool(name: "test", description: "Test") { helloWorld }\`;
      `,
    });
    vi.spyOn(glob, "glob").mockImplementation(() =>
      Promise.resolve(["my-component.tsx"])
    );
    vi.spyOn(path, "resolve").mockImplementation((_, file) => file);
    vi.spyOn(fs, "writeFileSync");

    const plugin = ApplicationManifestPlugin();
    plugin.configResolved({ command: "serve", server: {} });

    await expect(
      async () => await plugin.buildStart()
    ).rejects.toThrowErrorMatchingInlineSnapshot(
      `[Error: Expected 'labels.toolInvocation.invoked' to be of type 'string' but found 'boolean' instead.]`
    );
  });

  test("Should error when labels.toolInvocation.invoked in @tool is not a string", async () => {
    mockReadFile({
      "package.json": JSON.stringify({}),
      "my-component.tsx": `
        const MY_QUERY = gql\`query HelloWorldQuery @tool(name: "test", description: "Test", labels: { toolInvocation: { invoked: true } }) { helloWorld }\`;
      `,
    });
    vi.spyOn(glob, "glob").mockImplementation(() =>
      Promise.resolve(["my-component.tsx"])
    );
    vi.spyOn(path, "resolve").mockImplementation((_, file) => file);
    vi.spyOn(fs, "writeFileSync");

    const plugin = ApplicationManifestPlugin();
    plugin.configResolved({ command: "serve", server: {} });

    await expect(
      async () => await plugin.buildStart()
    ).rejects.toThrowErrorMatchingInlineSnapshot(
      `[Error: Expected 'labels.toolInvocation.invoked' to be of type 'string' but found 'boolean' instead.]`
    );
  });

  test("Should allow empty labels value", async () => {
    mockReadFile({
      "package.json": JSON.stringify({
        labels: {},
      }),
      "my-component.tsx": `
        const MY_QUERY = gql\`query HelloWorldQuery @tool(name: "test", description: "Test", labels: {}) { helloWorld }\`;
      `,
    });
    vi.spyOn(glob, "glob").mockImplementation(() =>
      Promise.resolve(["my-component.tsx"])
    );
    vi.spyOn(path, "resolve").mockImplementation((_, file) => file);
    vi.spyOn(fs, "writeFileSync");

    const plugin = ApplicationManifestPlugin();
    plugin.configResolved({ command: "serve", server: {}, build: {} });

    await expect(plugin.buildStart()).resolves.toBeUndefined();
  });

  test("Should error when an unknown type is discovered", async () => {
    mockReadFile({
      "package.json": JSON.stringify({}),
      "my-component.tsx": `
        const MY_QUERY = gql\`query HelloWorldQuery @tool(name: "hello-world", description: "hello", extraInputs: [{
          name: 3.1
        }] ) { helloWorld }\`;
      `,
    });
    vi.spyOn(glob, "glob").mockImplementation(() =>
      Promise.resolve(["my-component.tsx"])
    );
    vi.spyOn(path, "resolve").mockImplementation((_, file) => file);
    vi.spyOn(fs, "writeFileSync");

    const plugin = ApplicationManifestPlugin();
    plugin.configResolved({ command: "serve", server: {} });

    await expect(
      async () => await plugin.buildStart()
    ).rejects.toThrowErrorMatchingInlineSnapshot(
      `[Error: Error when parsing directive values: unexpected type 'FloatValue']`
    );
  });

  test("Should order operations and fragments when generating normalized operation", async () => {
    mockReadFile({
      "package.json": JSON.stringify({}),
      [`${root}/my-component.tsx`]: `
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
    vi.spyOn(glob, "glob").mockImplementation(() =>
      Promise.resolve(["my-component.tsx"])
    );
    vi.spyOn(fs, "writeFileSync");

    const plugin = ApplicationManifestPlugin();
    plugin.configResolved({
      command: "serve",
      server: {},
      build: { outDir: "/dist" },
    });
    await plugin.buildStart();
    let [file, content] = (fs.writeFileSync as unknown as Mock).mock.calls[0];

    // Ignore the hash so we can do a snapshot that doesn't constantly change
    let contentObj = JSON.parse(content);
    contentObj.hash = "abc";

    expect(fs.writeFileSync).toHaveBeenCalledTimes(2);
    expect(file).toBe(`${root}/dist/.application-manifest.json`);
    expect(contentObj).toMatchInlineSnapshot(`
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
        "resource": "http://localhost:undefined",
        "version": "1",
      }
    `);
  });
});

describe("writeBundle", () => {
  test("Should use custom entry point when in build mode and provided in package.json", async () => {
    mockReadFile({
      "package.json": JSON.stringify({
        entry: {
          staging: "http://staging.awesome.com",
        },
      }),
      "my-component.tsx": `
        const MY_QUERY = gql\`query HelloWorldQuery @tool(name: "hello-world", description: "This is an awesome tool!") { helloWorld }\`;
      `,
    });
    vi.spyOn(glob, "glob").mockImplementation(() =>
      Promise.resolve(["my-component.tsx"])
    );
    vi.spyOn(path, "resolve").mockImplementation((_, file) => file);
    vi.spyOn(path, "dirname").mockImplementation(() => "/dist");
    vi.spyOn(fs, "writeFileSync");

    const plugin = ApplicationManifestPlugin();
    plugin.configResolved({
      command: "build",
      mode: "staging",
      server: {},
      build: { outDir: "/dist/" },
    });
    await plugin.buildStart();
    await plugin.writeBundle();

    let [, content] = (fs.writeFileSync as unknown as Mock).mock.calls[0];
    let contentObj = JSON.parse(content);

    expect(contentObj.resource).toBe("http://staging.awesome.com");
  });

  test("Should use index.html when in build production and not provided in package.json", async () => {
    mockReadFile({
      "package.json": JSON.stringify({}),
      "my-component.tsx": `
        const MY_QUERY = gql\`query HelloWorldQuery @tool(name: "hello-world", description: "This is an awesome tool!") { helloWorld }\`;
      `,
    });
    vi.spyOn(glob, "glob").mockImplementation(() =>
      Promise.resolve(["my-component.tsx"])
    );
    vi.spyOn(path, "resolve").mockImplementation((_, file) => file);
    vi.spyOn(path, "dirname").mockImplementation(() => "/dist");
    vi.spyOn(fs, "writeFileSync");

    const plugin = ApplicationManifestPlugin();
    plugin.configResolved({
      command: "build",
      mode: "production",
      server: {},
      build: { outDir: "/dist/" },
    });
    await plugin.buildStart();
    await plugin.writeBundle();

    let [, content] = (fs.writeFileSync as unknown as Mock).mock.calls[0];
    let contentObj = JSON.parse(content);

    expect(contentObj.resource).toBe("index.html");
  });

  test("Should throw an error when in build mode and using a mode that is not production and not provided in package.json", async () => {
    mockReadFile({
      "package.json": JSON.stringify({}),
      "my-component.tsx": `
        const MY_QUERY = gql\`query HelloWorldQuery @tool(name: "hello-world", description: "This is an awesome tool!") { helloWorld }\`;
      `,
    });
    vi.spyOn(glob, "glob").mockImplementation(() =>
      Promise.resolve(["my-component.tsx"])
    );
    vi.spyOn(path, "resolve").mockImplementation((_, file) => file);
    vi.spyOn(path, "dirname").mockImplementation(() => "/dist");
    vi.spyOn(fs, "writeFileSync");

    const plugin = ApplicationManifestPlugin();
    plugin.configResolved({
      command: "build",
      mode: "staging",
      server: {},
      build: { outDir: "/dist/" },
    });
    await plugin.buildStart();

    await expect(
      async () => await plugin.writeBundle()
    ).rejects.toThrowErrorMatchingInlineSnapshot(
      `[Error: No entry point found for mode "staging". Entry points other than "development" and "production" must be defined in package.json file.]`
    );
  });

  test("Should always write to both locations when running in build mode", async () => {
    mockReadFile({
      "package.json": JSON.stringify({}),
      "my-component.tsx": `
        const MY_QUERY = gql\`query HelloWorldQuery @tool(name: "hello-world", description: "This is an awesome tool!") { helloWorld }\`;
      `,
    });
    vi.spyOn(glob, "glob").mockImplementation(() =>
      Promise.resolve(["my-component.tsx"])
    );
    vi.spyOn(path, "resolve").mockImplementation((_, file) => file);
    vi.spyOn(path, "dirname").mockImplementation(() => "/dist");
    vi.spyOn(fs, "writeFileSync");

    const plugin = ApplicationManifestPlugin();
    plugin.configResolved({
      command: "build",
      mode: "production",
      server: {},
      build: { outDir: "/dist/" },
    });
    await plugin.buildStart();
    await plugin.writeBundle();

    expect(fs.writeFileSync).toBeCalledTimes(2);
  });
});

describe("configureServer", () => {
  test("Should write to manifest file when package.json or file is updated", async () => {
    mockReadFile({
      "package.json": JSON.stringify({}),
      "my-component.tsx": `
        const MY_QUERY = gql\`query HelloWorldQuery($name: string!) @tool(name: "hello-world", description: "This is an awesome tool!", extraInputs: [{
          name: "doStuff",
          type: "boolean",
          description: "Should we do stuff?"
        }]) { helloWorld(name: $name) }\`;
      `,
    });
    vi.spyOn(glob, "glob").mockImplementation(() =>
      Promise.resolve(["my-component.tsx"])
    );
    vi.spyOn(path, "resolve").mockImplementation((_, file) => file);
    vi.spyOn(fs, "writeFileSync");

    let _callbacks: Function[] = [];

    const server = {
      watcher: {
        init: () => {
          _callbacks = [];
        },
        on: (_event: string, callback: Function) => {
          _callbacks.push(callback);
        },
        trigger: async (file: string) => {
          for (const callback of _callbacks) {
            await callback(file);
          }
        },
      },
    };
    server.watcher.init();

    const plugin = ApplicationManifestPlugin();
    plugin.configResolved({
      command: "serve",
      server: {},
      build: { outDir: "/dist" },
    });
    await plugin.buildStart();
    plugin.configureServer(server);
    await server.watcher.trigger("package.json");
    await server.watcher.trigger("my-component.tsx");

    expect(fs.writeFileSync).toBeCalledTimes(6);
  });
});

type FilePath = string;

function mockReadFile(mocks: Record<FilePath, string | (() => string)>) {
  vi.spyOn(fs, "readFileSync").mockImplementation((path) => {
    const mock = mocks[path.toString()];

    if (!mock) {
      throw new Error(`No matched mock for path '${path}'`);
    }

    if (typeof mock === "function") {
      return mock();
    }

    return mock;
  });
}
