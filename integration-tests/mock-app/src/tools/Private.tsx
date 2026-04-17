import { gql, type TypedDocumentNode } from "@apollo/client";
import { useQuery } from "@apollo/client/react";

interface Data {
  user: {
    address: string;
    fullName: string;
  };
}

const PRIVATE_QUERY: TypedDocumentNode<Data, Record<string, never>> = gql`
  "Returns private user information"
  query Private @tool {
    user @private {
      fullName
      address
    }
  }
`;

export function Private() {
  const { data, dataState } = useQuery(PRIVATE_QUERY);

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
