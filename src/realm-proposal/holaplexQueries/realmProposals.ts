import { gql } from 'graphql-request';
import * as IT from 'io-ts';

export const query = gql`
  query ($governances: [PublicKey!]!) {
    proposals(governances: $governances) {
      address
      closedAt
      description
      draftAt
      executingAt
      name
      signingOffAt
      startVotingAt
      state
      votingAt
      votingCompletedAt
      governance {
        governanceConfig {
          maxVotingTime
        }
      }
      proposalOptions {
        transactionsCount
      }
    }
  }
`;

export const respProposal = IT.type({
  address: IT.string,
  closedAt: IT.union([IT.string, IT.null]),
  description: IT.string,
  draftAt: IT.string,
  executingAt: IT.union([IT.string, IT.null]),
  name: IT.string,
  signingOffAt: IT.union([IT.string, IT.null]),
  startVotingAt: IT.union([IT.string, IT.null]),
  state: IT.string,
  votingAt: IT.union([IT.string, IT.null]),
  votingCompletedAt: IT.union([IT.string, IT.null]),
  governance: IT.union([
    IT.type({
      governanceConfig: IT.union([
        IT.type({
          maxVotingTime: IT.string,
        }),
        IT.null,
      ]),
    }),
    IT.null,
  ]),
  proposalOptions: IT.array(
    IT.type({
      transactionsCount: IT.number,
    }),
  ),
});

export const resp = IT.type({
  proposals: IT.array(respProposal),
});
