import { registerEnumType } from '@nestjs/graphql';

/**
 * A vote for a comment, affecting the comment's score
 */
export enum RealmFeedItemCommentVoteType {
  Approve = 'Approve',
  Disapprove = 'Disapprove',
}

registerEnumType(RealmFeedItemCommentVoteType, {
  name: 'RealmFeedItemCommentVoteType',
  description: 'A vote on a comment',
  valuesMap: {
    [RealmFeedItemCommentVoteType.Approve]: {
      description: 'The comment was approved',
    },
    [RealmFeedItemCommentVoteType.Disapprove]: {
      description: 'The comment was disapproved',
    },
  },
});
