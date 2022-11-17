import { gql } from 'graphql-request';
import * as IT from 'io-ts';

import { respVoteRecord } from './voteRecordsForProposal';

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

export { respVoteRecord };

export const resp = IT.type({
  voteRecords: IT.array(respVoteRecord),
});
