import { expect, test, vi } from "vitest";
import { ApolloProvider } from "../ApolloProvider";
import { render } from "@testing-library/react";
import { ApolloClient } from "../../core/ApolloClient";
import { SET_GLOBALS_EVENT_TYPE } from "../../types/openai";

test("Should call prefetch data when window.open is immediately available", () => {
  vi.stubGlobal("openai", {
    toolOutput: {},
  });

  const client = {
    prefetchData: vi.fn(async () => {}),
  } as unknown as ApolloClient;

  render(<ApolloProvider client={client} />);

  expect(client.prefetchData).toBeCalled();
});

test("Should NOT call prefetch data when window.open is not immediately available", () => {
  const client = {
    prefetchData: vi.fn(async () => {}),
  } as unknown as ApolloClient;

  render(<ApolloProvider client={client} />);

  expect(client.prefetchData).not.toBeCalled();
});

test("Should call prefetch data when window.open is not immediately available and event is sent", () => {
  const client = {
    prefetchData: vi.fn(async () => {}),
  } as unknown as ApolloClient;

  render(<ApolloProvider client={client} />);

  window.dispatchEvent(new CustomEvent(SET_GLOBALS_EVENT_TYPE));

  expect(client.prefetchData).toBeCalled();
});
