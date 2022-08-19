import { Field, ObjectType, ID, createUnionType } from '@nestjs/graphql';

import { RealmProposal } from '@src/realm-proposal/dto/RealmProposal';

import { RealmFeedItemType } from './RealmFeedItemType';

@ObjectType({
  description: 'A post feed item',
})
export class RealmFeedItemPost {
  @Field(() => RealmFeedItemType, {
    description: 'A discriminant indicating this is a post item',
  })
  type: RealmFeedItemType;

  @Field(() => ID)
  id: string;
}

@ObjectType({
  description: 'A proposal feed item',
})
export class RealmFeedItemProposal {
  @Field(() => RealmFeedItemType, {
    description: 'A discriminant indicating this is a proposal item',
  })
  type: RealmFeedItemType;

  @Field(() => ID)
  id: string;

  @Field(() => RealmProposal, {
    description: 'The proposal',
  })
  proposal: RealmProposal;
}

export const RealmFeedItem = createUnionType({
  name: 'RealmFeedItem',
  types: () => [RealmFeedItemPost, RealmFeedItemProposal] as const,
});
