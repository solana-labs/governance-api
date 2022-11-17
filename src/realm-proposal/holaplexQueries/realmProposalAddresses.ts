import { gql } from 'graphql-request';
import * as IT from 'io-ts';

export const query = gql`
  query ($governances: [PublicKey!]!) {
    proposals(governances: $governances) {
      ... on ProposalV1 {
        address
        closedAt
        draftAt
        executingAt
        signingOffAt
        votingAt
        votingCompletedAt
      }
      ... on ProposalV2 {
        address
        closedAt
        draftAt
        executingAt
        signingOffAt
        startVotingAt
        votingAt
        votingCompletedAt
      }
    }
  }
`;

export const resp = IT.type({
  proposals: IT.array(
    IT.type({
      address: IT.string,
      closedAt: IT.union([IT.string, IT.null]),
      draftAt: IT.string,
      executingAt: IT.union([IT.string, IT.null]),
      signingOffAt: IT.union([IT.string, IT.null]),
      startVotingAt: IT.union([IT.string, IT.null, IT.undefined]),
      votingAt: IT.union([IT.string, IT.null]),
      votingCompletedAt: IT.union([IT.string, IT.null]),
    }),
  ),
});
