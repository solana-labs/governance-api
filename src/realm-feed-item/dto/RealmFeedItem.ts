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
  type: RealmFeedItemType.Post;

  @Field(() => Date, {
    description: 'When the feed item was created',
  })
  created: Date;

  @Field(() => ID)
  id: string;

  @Field(() => Number, {
    description: 'The total raw score for the feed item',
  })
  score: number;

  @Field(() => Date, {
    description: 'When the feed item was last updated',
  })
  updated: Date;
}

@ObjectType({
  description: 'A proposal feed item',
})
export class RealmFeedItemProposal {
  @Field(() => RealmFeedItemType, {
    description: 'A discriminant indicating this is a proposal item',
  })
  type: RealmFeedItemType.Proposal;

  @Field(() => Date, {
    description: 'When the feed item was created',
  })
  created: Date;

  @Field(() => ID)
  id: string;

  @Field(() => RealmProposal, {
    description: 'The proposal',
  })
  proposal: RealmProposal;

  @Field(() => Number, {
    description: 'The total raw score for the feed item',
  })
  score: number;

  @Field(() => Date, {
    description: 'When the feed item was last updated',
  })
  updated: Date;
}

export const RealmFeedItem = createUnionType({
  name: 'RealmFeedItem',
  description: "An item in a Realm's feed",
  resolveType: (value) => {
    if (value.type === RealmFeedItemType.Proposal) {
      return RealmFeedItemProposal;
    }

    return RealmFeedItemPost;
  },
  types: () => [RealmFeedItemPost, RealmFeedItemProposal] as const,
});
