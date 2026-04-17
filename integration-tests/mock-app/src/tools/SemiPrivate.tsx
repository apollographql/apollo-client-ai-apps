import { gql, type TypedDocumentNode } from "@apollo/client";
import { useQuery } from "@apollo/client/react";

interface Data {
  user: {
    address: string;
    fullName: string;
  };
}

const SEMI_PRIVATE_QUERY: TypedDocumentNode<Data, Record<string, never>> = gql`
  "Returns user information with a private field"
  query SemiPrivate @tool {
    user {
      fullName
      address @private
    }
  }
`;

export function SemiPrivate() {
  const { data, dataState } = useQuery(SEMI_PRIVATE_QUERY);

  if (dataState !== "complete") {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <div data-testid="fullName">{data.user.fullName}</div>
      <div data-testid="address">{data.user.address}</div>
    </div>
  );
}
