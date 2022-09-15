import { Field, ObjectType } from '@nestjs/graphql';

import { RichTextDocumentScalar } from '@lib/scalars/RichTextDocument';
import { RichTextDocument } from '@lib/types/RichTextDocument';
import { RealmFeedItemCommentIDScalar } from '@src/lib/scalars/RealmFeedItemCommentID';
import { RealmFeedItemIDScalar } from '@src/lib/scalars/RealmFeedItemID';
import { RealmMember } from '@src/realm-member/dto/RealmMember';

import { RealmFeedItemCommentVoteType } from './RealmFeedItemCommentVoteType';

@ObjectType({
  description: 'A comment on a feed item',
})
export class RealmFeedItemComment {
  @Field(() => RealmMember, {
    description: 'The creator of the comment',
    nullable: true,
  })
  author?: RealmMember;

  @Field(() => Date, {
    description: 'When the comment was created',
  })
  created: Date;

  @Field(() => RichTextDocumentScalar, {
    description: 'Comment body text',
  })
  document: RichTextDocument;

  @Field(() => RealmFeedItemIDScalar, {
    description: 'ID of the feed item the comment is in',
  })
  feedItemId: number;

  @Field(() => RealmFeedItemCommentIDScalar, {
    description: 'ID of the comment',
  })
  id: number;

  @Field(() => RealmFeedItemCommentVoteType, {
    description: "The requesting user's vote on the comment",
    nullable: true,
  })
  myVote?: RealmFeedItemCommentVoteType;

  @Field(() => RealmFeedItemCommentIDScalar, {
    description: 'ID of the parent comment',
    nullable: true,
  })
  parentCommentId?: number | null;

  @Field(() => [RealmFeedItemComment], {
    description: 'Replies to the comment',
    nullable: true,
  })
  replies?: RealmFeedItemComment[] | null;

  @Field(() => Number, {
    description: 'The number of immediate replies to this comment',
  })
  repliesCount: number;

  @Field(() => Number, {
    description: 'The total raw score for the comment',
  })
  score: number;

  @Field(() => Date, {
    description: 'When the comment was last updated',
  })
  updated: Date;
}
