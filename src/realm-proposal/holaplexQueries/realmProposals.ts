import { gql } from 'graphql-request';
import * as IT from 'io-ts';

export const query = gql`
  query ($governances: [PublicKey!]!) {
    proposals(governances: $governances) {
      address
      description
      name
    }
  }
`;

export const resp = IT.type({
  proposals: IT.array(
    IT.type({
      address: IT.string,
      description: IT.string,
      name: IT.string,
    }),
  ),
});
