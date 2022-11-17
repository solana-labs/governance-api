import { gql } from 'graphql-request';
import * as IT from 'io-ts';

export const query = gql`
  query ($address: PublicKey!) {
    realms(addresses: [$address]) {
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
