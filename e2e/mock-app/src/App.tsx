import { gql, type TypedDocumentNode } from "@apollo/client";
import { useQuery } from "@apollo/client/react";

interface HelloQueryData {
  hello: string;
}

const HELLO_QUERY: TypedDocumentNode<HelloQueryData> = gql`
  query Hello @tool(name: "Hello", description: "Returns a greeting.") {
    hello
  }
`;

export function App() {
  const { data } = useQuery(HELLO_QUERY);

  return <h1 data-testid="greeting">{data?.hello}</h1>;
}
