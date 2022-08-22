import { gql } from 'graphql-request';
import * as IT from 'io-ts';

export const query = gql`
  query ($user: PublicKey!, $proposals: [PublicKey!]!) {
    voteRecords(governingTokenOwners: [$user], proposals: $proposals) {
      vote
      voterWeight
      proposal {
        address
      }
    }
  }
`;

export const respVoteRecord = IT.type({
  vote: IT.string,
  voterWeight: IT.string,
  proposal: IT.type({
    address: IT.string,
  }),
});

export const resp = IT.type({
  voteRecords: IT.array(respVoteRecord),
});
