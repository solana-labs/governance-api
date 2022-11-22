import { gql } from 'graphql-request';
import * as IT from 'io-ts';

export const query = gql`
  query ($mint: PublicKey!, $realm: PublicKey!) {
    tokenOwnerRecords(governingTokenMints: [$mint], realms: [$realm]) {
      governingTokenOwner
      governingTokenDepositAmount
    }
  }
`;

export const resp = IT.type({
  tokenOwnerRecords: IT.array(
    IT.type({
      governingTokenOwner: IT.string,
      governingTokenDepositAmount: IT.string,
    }),
  ),
});
