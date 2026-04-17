import { StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { InMemoryCache } from "@apollo/client";
import { ApolloClient } from "@apollo/client-ai-apps";
import { ApolloProvider } from "@apollo/client-ai-apps/react";
import manifest from "../.application-manifest.json";
import { App } from "./App.tsx";

const client = new ApolloClient({
  cache: new InMemoryCache(),
  manifest,
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Suspense fallback={<p>Loading…</p>}>
      <ApolloProvider client={client}>
        <App />
      </ApolloProvider>
    </Suspense>
  </StrictMode>
);
