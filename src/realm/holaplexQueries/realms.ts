import { gql } from 'graphql-request';
import * as IT from 'io-ts';

export const query = gql`
  query ($addresses: [PublicKey!]!) {
    realms(addresses: $addresses) {
      address
      name
    }
  }
`;

export const resp = IT.type({
  realms: IT.array(
    IT.type({
      address: IT.string,
      name: IT.string,
    }),
  ),
});
