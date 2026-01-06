import { expect, test, vi, describe, beforeEach, Mock } from "vitest";
import { AbsoluteAssetImportsPlugin } from "../absolute_asset_imports_plugin";

test("Should replace root relative scripts with full url when origin is provided", () => {
  const ctx = {
    server: {
      config: {
        server: {
          origin: "http://localhost:3000/",
        },
      },
    },
  };
  const html = `<html><head><script type="module" src="/@vite/client"></script></head><body><script module src="/assets/main.ts?t=12345"></script></body></html>`;
  const plugin = AbsoluteAssetImportsPlugin();

  let result = plugin.transformIndexHtml(html, ctx);

  expect(result).toMatchInlineSnapshot(
    `"<html><head><script type="module" src="http://localhost:3000/@vite/client"></script></head><body><script module src="http://localhost:3000/assets/main.ts?t=12345"></script></body></html>"`
  );
});

test("Should replace root relative scripts with full url when origin is not provided", () => {
  const ctx = {
    server: {
      resolvedUrls: {
        local: ["http://localhost:3000/"],
      },
    },
  };
  const html = `<html><head>    <script type="module">import { injectIntoGlobalHook } from "/@react-refresh";
injectIntoGlobalHook(window);
window.$RefreshReg$ = () => {};
window.$RefreshSig$ = () => (type) => type;</script></head></html>`;
  const plugin = AbsoluteAssetImportsPlugin();

  let result = plugin.transformIndexHtml(html, ctx);

  expect(result).toMatchInlineSnapshot(`
    "<html><head>    <script type="module">import { injectIntoGlobalHook } from "http://localhost:3000/@react-refresh";
    injectIntoGlobalHook(window);
    window.$RefreshReg$ = () => {};
    window.$RefreshSig$ = () => (type) => type;</script></head></html>"
  `);
});

test("Should replace root relative imports with full url when origin is provided", () => {
  const ctx = {
    server: {
      config: {
        server: {
          origin: "http://localhost:3000/",
        },
      },
    },
  };
  const html = `<html><head>    <script type="module">import { injectIntoGlobalHook } from "/@react-refresh";
injectIntoGlobalHook(window);
window.$RefreshReg$ = () => {};
window.$RefreshSig$ = () => (type) => type;</script></head></html>`;
  const plugin = AbsoluteAssetImportsPlugin();

  let result = plugin.transformIndexHtml(html, ctx);

  expect(result).toMatchInlineSnapshot(`
    "<html><head>    <script type="module">import { injectIntoGlobalHook } from "http://localhost:3000/@react-refresh";
    injectIntoGlobalHook(window);
    window.$RefreshReg$ = () => {};
    window.$RefreshSig$ = () => (type) => type;</script></head></html>"
  `);
});

test("Should replace root relative imports with full url when origin is not provided", () => {
  const ctx = {
    server: {
      resolvedUrls: {
        local: ["http://localhost:3000/"],
      },
    },
  };
  const html = `<html><body><script module src="/assets/main.ts?t=12345"></script></body></html>`;
  const plugin = AbsoluteAssetImportsPlugin();

  let result = plugin.transformIndexHtml(html, ctx);

  expect(result).toMatchInlineSnapshot(
    `"<html><body><script module src="http://localhost:3000/assets/main.ts?t=12345"></script></body></html>"`
  );
});

test("Should not modify html when not running a local server", () => {
  const ctx = {};
  const html = `<html><head><script type="module" src="/@vite/client"></script></head><body><script module src="/assets/main.ts?t=12345"></script></body></html>`;
  const plugin = AbsoluteAssetImportsPlugin();

  let result = plugin.transformIndexHtml(html, ctx);

  expect(result).toMatchInlineSnapshot(
    `"<html><head><script type="module" src="/@vite/client"></script></head><body><script module src="/assets/main.ts?t=12345"></script></body></html>"`
  );
});
