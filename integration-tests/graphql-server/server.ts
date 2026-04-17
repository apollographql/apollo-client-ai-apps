import { readFileSync } from "node:fs";
import { ApolloServer } from "@apollo/server";
import { startStandaloneServer } from "@apollo/server/standalone";

const typeDefs = readFileSync("/data/schema.graphql", "utf-8");

const resolvers = {
  Query: {
    hello: () => "Hello, world!",
    echo: (_: unknown, { message }: { message: string }) => message,
    user: () => ({ address: "1234 Main St", fullName: "MCP User" }),
  },
};

const server = new ApolloServer({ typeDefs, resolvers });

const { url } = await startStandaloneServer(server, {
  listen: { port: 4000, host: "0.0.0.0" },
});

console.log(`GraphQL server ready at ${url}`);
