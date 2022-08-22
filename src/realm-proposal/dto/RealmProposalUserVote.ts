import { Field, ObjectType, registerEnumType } from '@nestjs/graphql';
import BigNumber from 'bignumber.js';

import { BigNumberScalar } from '@src/lib/scalars/BigNumber';

export enum RealmProposalUserVoteType {
  Abstain = 'Abstain',
  No = 'No',
  Veto = 'Veto',
  Yes = 'Yes',
}

registerEnumType(RealmProposalUserVoteType, {
  name: 'RealmProposalUserVoteType',
  description: 'The way the user voted',
});

@ObjectType({
  description: 'A user vote on a proposal',
})
export class RealmProposalUserVote {
  @Field(() => RealmProposalUserVoteType, {
    description: 'The way the user voted',
  })
  type: RealmProposalUserVoteType;

  @Field(() => BigNumberScalar, {
    description: 'The vote weight used in the vote',
  })
  weight: BigNumber;
}
