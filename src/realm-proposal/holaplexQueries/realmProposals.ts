import { gql } from 'graphql-request';
import * as IT from 'io-ts';

import { respProposal } from './realmProposal';

export const query = gql`
  query ($governances: [PublicKey!]!) {
    proposals(governances: $governances, limit: 1000) {
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

export { respProposal };

export const resp = IT.type({
  proposals: IT.array(respProposal),
});
