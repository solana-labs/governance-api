import { ObjectType, registerEnumType } from '@nestjs/graphql';

import { EdgeType, ConnectionType } from '@lib/gqlTypes/Connection';

import { RealmFeedItemComment } from './RealmFeedItemComment';

@ObjectType()
export class RealmFeedItemCommentEdge extends EdgeType(
  'RealmFeedItemComment',
  RealmFeedItemComment as any,
) {}

@ObjectType()
export class RealmFeedItemCommentConnection extends ConnectionType<RealmFeedItemCommentEdge>(
  'RealmFeedItemComment',
  RealmFeedItemCommentEdge,
) {}

export enum RealmFeedItemCommentSort {
  New = 'New',
  Relevance = 'Relevance',
  TopAllTime = 'TopAllTime',
}

registerEnumType(RealmFeedItemCommentSort, {
  name: 'RealmFeedItemCommentSort',
  description: 'Sort order for a list of comments',
});
