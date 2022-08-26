import { Field, ObjectType } from '@nestjs/graphql';
import BigNumber from 'bignumber.js';

import { BigNumberScalar } from '@src/lib/scalars/BigNumber';

@ObjectType({
  description: 'The distribution of votes on a proposal',
})
export class RealmProposalVoteBreakdown {
  @Field(() => Number, {
    description: 'Percentage of the yes vote threshold that has been met',
    nullable: true,
  })
  percentThresholdMet?: number | null;

  @Field(() => BigNumberScalar, {
    description: 'The minimum number of yes votes required for the proposal to be valid',
    nullable: true,
  })
  threshold?: BigNumber | null;

  @Field(() => BigNumberScalar, {
    description: 'The total amount of `No` votes',
  })
  totalNoWeight: BigNumber;

  @Field(() => BigNumberScalar, {
    description: 'The total amount of `Yes` votes',
  })
  totalYesWeight: BigNumber;
}
