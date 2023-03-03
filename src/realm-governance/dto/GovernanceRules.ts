import { Field, ObjectType, registerEnumType, Int } from '@nestjs/graphql';
import { PublicKey } from '@solana/web3.js';
import { BigNumber } from 'bignumber.js';

import { BigNumberScalar } from '@lib/scalars/BigNumber';
import { PublicKeyScalar } from '@lib/scalars/PublicKey';

export enum GovernanceTokenType {
  Council = 'Council',
  Community = 'Community',
}

export enum GovernanceVoteTipping {
  Disabled = 'Disabled',
  Early = 'Early',
  Strict = 'Strict',
}

registerEnumType(GovernanceTokenType, {
  name: 'GovernanceTokenType',
});

registerEnumType(GovernanceVoteTipping, {
  name: 'GovernanceVoteTipping',
});

@ObjectType({
  description: 'Rules collection based on voter type',
})
export class TokenBasedGovernanceRules {
  @Field(() => Boolean, {
    description: 'Can holders of this token type create a proposal',
  })
  canCreateProposal: boolean;

  @Field(() => Boolean, {
    description: 'Can holders of this token type veto a proposal',
  })
  canVeto: boolean;

  @Field(() => Boolean, {
    description: 'Can holders of this token type vote',
  })
  canVote: boolean;

  @Field(() => Number, {
    description: 'The % of tokens that must vote Yes for the propsal to be valid',
  })
  quorumPercent: number;

  @Field(() => PublicKeyScalar, {
    description: 'Public address of the token mint',
  })
  tokenMintAddress: PublicKey;

  @Field(() => BigNumberScalar, {
    description: 'The token mint decimals',
  })
  tokenMintDecimals: BigNumber;

  @Field(() => GovernanceTokenType, {
    description: 'Token type the rules apply to',
  })
  tokenType: GovernanceTokenType;

  @Field(() => BigNumberScalar, {
    description: 'Total token supply',
  })
  totalSupply: BigNumber;

  @Field(() => Number, {
    description: 'The % of tokens that must veto a proposal for it to be vetoed',
  })
  vetoQuorumPercent: number;

  @Field(() => GovernanceVoteTipping, {
    description: 'How vote tipping behaves for this token type',
  })
  voteTipping: GovernanceVoteTipping;

  @Field(() => BigNumberScalar, {
    description: 'Voting power required to create a proposal',
  })
  votingPowerToCreateProposals: BigNumber;
}

@ObjectType({
  description: 'Rules for a governance',
})
export class GovernanceRules {
  @Field(() => PublicKeyScalar, {
    description: 'Address of the governance',
  })
  governanceAddress: PublicKey;

  @Field(() => Number, {
    description: 'Rules version',
  })
  version: number;

  @Field(() => Number, {
    description: 'Hours in the cool-off period',
  })
  coolOffHours: number;

  @Field(() => TokenBasedGovernanceRules, {
    description: 'Council token rules',
    nullable: true,
  })
  councilTokenRules: TokenBasedGovernanceRules | null;

  @Field(() => TokenBasedGovernanceRules, {
    description: 'Community token rules',
  })
  communityTokenRules: TokenBasedGovernanceRules;

  @Field(() => Int, {
    description: 'Number of deposit exempt proposals',
  })
  depositExemptProposalCount: number;

  @Field(() => Number, {
    description: 'Total max number of voting days',
  })
  maxVoteDays: number;

  @Field(() => Number, {
    description: 'Minimum number of days to holdup instruction execution',
  })
  minInstructionHoldupDays: number;

  @Field(() => PublicKeyScalar, {
    description: 'The wallet associated with this governance',
  })
  walletAddress: PublicKey;
}
