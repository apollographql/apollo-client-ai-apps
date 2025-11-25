import { expect, test, describe, vi } from "vitest";
import { ExtendedApolloProvider } from "./provider";
import { ApplicationManifest } from "../types/application-manifest";
import { parse } from "graphql";
import { render, screen } from "@testing-library/react";
import { ExtendedApolloClient } from "./client";
import { SET_GLOBALS_EVENT_TYPE } from "../types/openai";

test("Should call prefetch data when window.open is immediately available", () => {
  vi.stubGlobal("openai", {
    toolOutput: {},
  });

  const client = {
    prefetchData: vi.fn(async () => {}),
  } as unknown as ExtendedApolloClient;

  render(<ExtendedApolloProvider client={client} />);

  expect(client.prefetchData).toBeCalled();
});

test("Should NOT call prefetch data when window.open is not immediately available", () => {
  const client = {
    prefetchData: vi.fn(async () => {}),
  } as unknown as ExtendedApolloClient;

  render(<ExtendedApolloProvider client={client} />);

  expect(client.prefetchData).not.toBeCalled();
});

test("Should call prefetch data when window.open is not immediately available and event is sent", () => {
  const client = {
    prefetchData: vi.fn(async () => {}),
  } as unknown as ExtendedApolloClient;

  render(<ExtendedApolloProvider client={client} />);

  window.dispatchEvent(new CustomEvent(SET_GLOBALS_EVENT_TYPE));

  expect(client.prefetchData).toBeCalled();
});
