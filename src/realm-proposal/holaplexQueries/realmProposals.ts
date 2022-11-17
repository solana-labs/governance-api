import { gql } from 'graphql-request';
import * as IT from 'io-ts';

import { respProposal } from './realmProposal';

export const query = gql`
  query ($governances: [PublicKey!]!) {
    proposals(governances: $governances) {
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
        }
      }
    }
  }
`;

export { respProposal };

export const resp = IT.type({
  proposals: IT.array(respProposal),
});
