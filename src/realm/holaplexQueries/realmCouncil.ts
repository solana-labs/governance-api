import { gql } from 'graphql-request';
import * as IT from 'io-ts';

export const query = gql`
  query ($address: PublicKey!) {
    realms(addresses: [$address]) {
      address
      realmConfig {
        councilMint
      }
    }
  }
`;

export const resp = IT.type({
  realms: IT.array(
    IT.type({
      address: IT.string,
      realmConfig: IT.union([
        IT.null,
        IT.type({
          councilMint: IT.union([IT.null, IT.string]),
        }),
      ]),
    }),
  ),
});
