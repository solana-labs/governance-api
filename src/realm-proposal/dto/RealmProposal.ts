import { ObjectType, Field } from '@nestjs/graphql';
import { PublicKey } from '@solana/web3.js';

import { PublicKeyScalar } from '@lib/scalars/PublicKey';

import { RealmProposalState } from './RealmProposalState';
import { RealmProposalUserVote } from './RealmProposalUserVote';

@ObjectType({
  description: 'A proposal in a Realm',
})
export class RealmProposal {
  @Field(() => Date, {
    description: 'Creation timestamp',
  })
  created: Date;

  @Field(() => String, {
    description: 'Description for the proposal',
  })
  description: string;

  @Field(() => PublicKeyScalar, {
    description: 'Public Key address for the proposal',
  })
  publicKey: PublicKey;

  @Field(() => RealmProposalUserVote, {
    description: "The requesting user's vote",
    nullable: true,
  })
  myVote?: RealmProposalUserVote | null;

  @Field(() => RealmProposalState, {
    description: 'Current state of the proposal',
  })
  state: RealmProposalState;

  @Field(() => String, {
    description: 'Title for the proposal',
  })
  title: string;

  @Field(() => Date, {
    description: 'Update timestamp',
  })
  updated: Date;
}
