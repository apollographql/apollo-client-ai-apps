import { act, render } from "@testing-library/react";

// Helper to silence act warnings when testing a component that suspends.
// See https://github.com/testing-library/react-testing-library/issues/1375
export async function renderAsync(...args: Parameters<typeof render>) {
  return await act(async () => render(...args));
}
