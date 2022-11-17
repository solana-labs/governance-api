import { registerEnumType } from '@nestjs/graphql';

/**
 * A vote for a feed item, affecting the feed item's score
 */
export enum RealmFeedItemVoteType {
  Approve = 'Approve',
  Disapprove = 'Disapprove',
}

registerEnumType(RealmFeedItemVoteType, {
  name: 'RealmFeedItemVoteType',
  description: 'A vote on a feed item',
  valuesMap: {
    [RealmFeedItemVoteType.Approve]: {
      description: 'The feed item was approved',
    },
    [RealmFeedItemVoteType.Disapprove]: {
      description: 'The feed item was disapproved',
    },
  },
});
