import { gql } from 'graphql-request';
import * as IT from 'io-ts';

export const query = gql`
  query ($proposal: PublicKey!) {
    proposals(addresses: [$proposal]) {
      ... on ProposalV1 {
        address
        closedAt
        description
        draftAt
        executingAt
        instructionsCount
        governingTokenMint
        name
        signingOffAt
        state
        votingAt
        votingCompletedAt
        governance {
          address
          governanceConfig {
            maxVotingTime
            voteThresholdPercentage
          }
          realm {
            address
            communityMint
            realmConfig {
              communityMintMaxVoteWeight
              communityMintMaxVoteWeightSource
              councilMint
            }
          }
        }
        tokenOwnerRecord {
          address
        }
      }
      ... on ProposalV2 {
        address
        closedAt
        description
        draftAt
        executingAt
        governingTokenMint
        name
        signingOffAt
        startVotingAt
        state
        votingAt
        votingCompletedAt
        governance {
          address
          governanceConfig {
            maxVotingTime
            voteThresholdPercentage
          }
          realm {
            address
            communityMint
            realmConfig {
              communityMintMaxVoteWeight
              communityMintMaxVoteWeightSource
              councilMint
            }
          }
        }
        proposalOptions {
          transactionsCount
        }
        tokenOwnerRecord {
          address
        }
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
  instructionsCount: IT.union([IT.number, IT.null, IT.undefined]),
  governingTokenMint: IT.string,
  name: IT.string,
  signingOffAt: IT.union([IT.string, IT.null]),
  startVotingAt: IT.union([IT.string, IT.null, IT.undefined]),
  state: IT.string,
  votingAt: IT.union([IT.string, IT.null]),
  votingCompletedAt: IT.union([IT.string, IT.null]),
  governance: IT.union([
    IT.type({
      address: IT.string,
      governanceConfig: IT.union([
        IT.type({
          maxVotingTime: IT.string,
          voteThresholdPercentage: IT.number,
        }),
        IT.null,
      ]),
      realm: IT.union([
        IT.type({
          address: IT.string,
          communityMint: IT.string,
          realmConfig: IT.union([
            IT.null,
            IT.type({
              communityMintMaxVoteWeight: IT.string,
              communityMintMaxVoteWeightSource: IT.string,
              councilMint: IT.union([IT.null, IT.string]),
            }),
          ]),
        }),
        IT.null,
      ]),
    }),
    IT.null,
  ]),
  proposalOptions: IT.union([
    IT.null,
    IT.undefined,
    IT.array(
      IT.type({
        transactionsCount: IT.number,
      }),
    ),
  ]),
  tokenOwnerRecord: IT.union([
    IT.null,
    IT.undefined,
    IT.type({
      address: IT.string,
    }),
  ]),
});

export const resp = IT.type({
  proposals: IT.array(respProposal),
});
