import { Field, ObjectType, createUnionType } from '@nestjs/graphql';
import { PublicKey } from '@solana/web3.js';

import { PublicKeyScalar } from '@lib/scalars/PublicKey';
import { RichTextDocumentScalar } from '@lib/scalars/RichTextDocument';
import { RichTextDocument } from '@lib/types/RichTextDocument';
import { RealmFeedItemIDScalar } from '@src/lib/scalars/RealmFeedItemID';
import { RealmMember } from '@src/realm-member/dto/RealmMember';
import { RealmPost } from '@src/realm-post/dto/RealmPost';
import { RealmProposal } from '@src/realm-proposal/dto/RealmProposal';

import { RealmFeedItemType } from './RealmFeedItemType';
import { RealmFeedItemVoteType } from './RealmFeedItemVoteType';

@ObjectType({
  description: 'A post feed item',
})
export class RealmFeedItemPost {
  @Field(() => RealmFeedItemType, {
    description: 'A discriminant indicating this is a post item',
  })
  type: RealmFeedItemType.Post;

  @Field(() => RealmMember, {
    description: 'The creator of the post',
    nullable: true,
  })
  author: RealmMember;

  @Field(() => Date, {
    description: 'When the feed item was created',
  })
  created: Date;

  @Field(() => RichTextDocumentScalar, {
    description: 'Post body text',
  })
  document: RichTextDocument;

  @Field(() => RealmFeedItemIDScalar)
  id: number;

  @Field(() => RealmFeedItemVoteType, {
    description: "The requesting user's vote on the feed item",
    nullable: true,
  })
  myVote?: RealmFeedItemVoteType;

  @Field(() => RealmPost, {
    description: 'The post',
  })
  post: RealmPost;

  @Field(() => PublicKeyScalar, {
    description: 'Public key of the realm the post is in',
  })
  realmPublicKey: PublicKey;

  @Field(() => Number, {
    description: 'The total raw score for the feed item',
  })
  score: number;

  @Field(() => String, {
    description: 'Title for the post',
  })
  title: string;

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

  @Field(() => RealmMember, {
    description: 'The creator of the proposal',
    nullable: true,
  })
  author?: RealmMember;

  @Field(() => Date, {
    description: 'When the feed item was created',
  })
  created: Date;

  @Field(() => RichTextDocumentScalar, {
    description: 'Proposal body text',
  })
  document: RichTextDocument;

  @Field(() => RealmFeedItemIDScalar)
  id: number;

  @Field(() => RealmFeedItemVoteType, {
    description: "The requesting user's vote on the feed item",
    nullable: true,
  })
  myVote?: RealmFeedItemVoteType;

  @Field(() => RealmProposal, {
    description: 'The proposal',
  })
  proposal: RealmProposal;

  @Field(() => PublicKeyScalar, {
    description: 'Public key of the realm the proposal is in',
  })
  realmPublicKey: PublicKey;

  @Field(() => Number, {
    description: 'The total raw score for the feed item',
  })
  score: number;

  @Field(() => String, {
    description: 'Title for the proposal',
  })
  title: string;

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
