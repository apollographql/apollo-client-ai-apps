import { gql, type TypedDocumentNode } from "@apollo/client";
import { useQuery } from "@apollo/client/react";
import { createHydrationUtils } from "@apollo/client-ai-apps/react";

interface Data {
  echo: string;
}

interface Variables {
  message: string;
}

const ECHO_QUERY: TypedDocumentNode<Data, Variables> = gql`
  "Echos the message back to the user"
  query Echo($message: String!) @tool {
    echo(message: $message)
  }
`;

const { useHydratedVariables } = createHydrationUtils(ECHO_QUERY);

export function Echo() {
  const [variables] = useHydratedVariables({ message: "Hello, world" });
  const { data, dataState } = useQuery(ECHO_QUERY, { variables });

  if (dataState !== "complete") {
    return <div>Loading...</div>;
  }

  return <div data-testid="echo">{data.echo}</div>;
}
