import { gql } from 'graphql-request';
import * as IT from 'io-ts';

export const query = gql`
  query ($realm: PublicKey!) {
    tokenOwnerRecords(realms: [$realm]) {
      address
      governingTokenDepositAmount
    }
  }
`;

export const resp = IT.type({
  tokenOwnerRecords: IT.array(
    IT.type({
      address: IT.string,
      governingTokenDepositAmount: IT.string,
    }),
  ),
});
