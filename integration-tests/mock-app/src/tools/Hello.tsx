import { gql, type TypedDocumentNode } from "@apollo/client";
import { useQuery } from "@apollo/client/react";

interface HelloQueryData {
  hello: string;
}

const HELLO_QUERY: TypedDocumentNode<HelloQueryData> = gql`
  "Returns a greeting"
  query Hello @tool {
    hello
  }
`;

export function Hello() {
  const { data } = useQuery(HELLO_QUERY);

  return <h1 data-testid="greeting">{data?.hello}</h1>;
}
