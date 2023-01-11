import { gql } from 'graphql-request';
import * as IT from 'io-ts';

export const query = gql`
  query governance($address: PublicKey!) {
    governances(addresses: [$address]) {
      address
      governanceConfig {
        governanceAddress
        voteThresholdType
        voteThresholdPercentage
        minCommunityWeightToCreateProposal
        minInstructionHoldUpTime
        maxVotingTime
        voteTipping
        proposalCoolOffTime
        minCouncilWeightToCreateProposal
      }
      realm {
        communityMint
        realmConfig {
          councilMint
        }
      }
    }
  }
`;

export const resp = IT.type({
  governances: IT.array(
    IT.type({
      address: IT.string,
      governanceConfig: IT.union([
        IT.null,
        IT.type({
          governanceAddress: IT.string,
          voteThresholdType: IT.string,
          voteThresholdPercentage: IT.number,
          minCommunityWeightToCreateProposal: IT.string,
          minInstructionHoldUpTime: IT.string,
          maxVotingTime: IT.string,
          voteTipping: IT.string,
          proposalCoolOffTime: IT.string,
          minCouncilWeightToCreateProposal: IT.string,
        }),
      ]),
      realm: IT.union([
        IT.null,
        IT.type({
          communityMint: IT.string,
          realmConfig: IT.union([
            IT.null,
            IT.type({
              councilMint: IT.union([IT.null, IT.string]),
            }),
          ]),
        }),
      ]),
    }),
  ),
});
