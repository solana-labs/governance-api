import { gql } from 'graphql-request';
import * as IT from 'io-ts';

export const query = gql`
  query governances($realms: [PublicKey!]!) {
    governances(realms: $realms) {
      address
      realm {
        communityMint
        realmConfig {
          communityMintMaxVoteWeight
          communityMintMaxVoteWeightSource
          councilMint
        }
      }
    }
  }
`;

export const respGovernance = IT.type({
  address: IT.string,
  realm: IT.union([
    IT.null,
    IT.type({
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
  ]),
});

export const resp = IT.type({
  governances: IT.array(respGovernance),
});
