import { gql } from 'graphql-request';
import * as IT from 'io-ts';

export const query = gql`
  query ($user: PublicKey!, $proposals: [PublicKey!]!) {
    voteRecords(governingTokenOwners: [$user], proposals: $proposals) {
      ... on VoteRecordV1 {
        voteType
        voteWeight
        proposal {
          address
        }
      }
      ... on VoteRecordV2 {
        vote
        voterWeight
        proposal {
          address
        }
      }
    }
  }
`;

export const respVoteRecord = IT.type({
  vote: IT.union([IT.null, IT.undefined, IT.string]),
  voteWeight: IT.union([IT.null, IT.undefined, IT.string]),
  voterWeight: IT.union([IT.null, IT.undefined, IT.string]),
  voteType: IT.union([IT.null, IT.undefined, IT.string]),
  proposal: IT.type({
    address: IT.string,
  }),
});

export const resp = IT.type({
  voteRecords: IT.array(respVoteRecord),
});
