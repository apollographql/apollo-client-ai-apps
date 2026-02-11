import { beforeEach, describe, expect, test, vi } from "vitest";
import { vol } from "memfs";
import { apolloClientAiApps } from "../apolloClientAiApps.js";
import { buildApp, setupServer } from "./utilities/build.js";

vi.mock("node:fs");
vi.mock("node:fs/promises");

beforeEach(() => {
  vol.reset();
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
