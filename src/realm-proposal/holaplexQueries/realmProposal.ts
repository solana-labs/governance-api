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
        maxVoteWeight
        name
        noVotesCount
        signingOffAt
        state
        votingAt
        votingCompletedAt
        yesVotesCount
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
          governingTokenOwner
        }
      }
      ... on ProposalV2 {
        address
        closedAt
        denyVoteWeight
        description
        draftAt
        executingAt
        governingTokenMint
        maxVoteWeight
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
          voteWeight
        }
        tokenOwnerRecord {
          address
          governingTokenOwner
        }
      }
    }
  }
`;

export const respProposal = IT.type({
  address: IT.string,
  closedAt: IT.union([IT.string, IT.null]),
  denyVoteWeight: IT.union([IT.string, IT.null, IT.undefined]),
  description: IT.string,
  draftAt: IT.string,
  executingAt: IT.union([IT.string, IT.null]),
  instructionsCount: IT.union([IT.number, IT.null, IT.undefined]),
  governingTokenMint: IT.string,
  maxVoteWeight: IT.union([IT.string, IT.null, IT.undefined]),
  name: IT.string,
  noVotesCount: IT.union([IT.string, IT.null, IT.undefined]),
  signingOffAt: IT.union([IT.string, IT.null]),
  startVotingAt: IT.union([IT.string, IT.null, IT.undefined]),
  state: IT.string,
  votingAt: IT.union([IT.string, IT.null]),
  votingCompletedAt: IT.union([IT.string, IT.null]),
  yesVotesCount: IT.union([IT.string, IT.null, IT.undefined]),
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
        voteWeight: IT.string,
      }),
    ),
  ]),
  tokenOwnerRecord: IT.union([
    IT.null,
    IT.undefined,
    IT.type({
      address: IT.string,
      governingTokenOwner: IT.string,
    }),
  ]),
});

export const resp = IT.type({
  proposals: IT.array(respProposal),
});
