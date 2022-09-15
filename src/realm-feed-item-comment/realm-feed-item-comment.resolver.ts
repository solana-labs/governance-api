import { UseGuards } from '@nestjs/common';
import { Args, Resolver, Mutation, Query } from '@nestjs/graphql';
import { PublicKey } from '@solana/web3.js';
import * as TE from 'fp-ts/TaskEither';

import { CurrentEnvironment, Environment } from '@lib/decorators/CurrentEnvironment';
import { CurrentUser, User } from '@lib/decorators/CurrentUser';
import { EitherResolver } from '@lib/decorators/EitherResolver';
import * as errors from '@lib/errors/gql';
import { ConnectionArgs } from '@lib/gqlTypes/Connection';
import { PublicKeyScalar } from '@lib/scalars/PublicKey';
import { RichTextDocumentScalar } from '@lib/scalars/RichTextDocument';
import { RichTextDocument } from '@lib/types/RichTextDocument';
import { AuthJwtGuard } from '@src/auth/auth.jwt.guard';
import { RealmFeedItemCommentIDScalar } from '@src/lib/scalars/RealmFeedItemCommentID';
import { RealmFeedItemIDScalar } from '@src/lib/scalars/RealmFeedItemID';

import { RealmFeedItemCommentSort, RealmFeedItemCommentConnection } from './dto/pagination';
import { RealmFeedItemComment } from './dto/RealmFeedItemComment';
import { RealmFeedItemCommentVoteType } from './dto/RealmFeedItemCommentVoteType';
import {
  RealmFeedItemCommentService,
  RealmFeedItemCommentCursor,
} from './realm-feed-item-comment.service';

@Resolver(() => RealmFeedItemComment)
export class RealmFeedItemCommentResolver {
  constructor(private readonly realmFeedItemCommentService: RealmFeedItemCommentService) {}

  @Mutation(() => RealmFeedItemComment, {
    description: 'Create a new comment for a feed item',
  })
  @UseGuards(AuthJwtGuard)
  @EitherResolver()
  createFeedItemComment(
    @Args('document', {
      type: () => RichTextDocumentScalar,
      description: 'Comment content',
    })
    document: RichTextDocument,
    @Args('feedItemId', {
      type: () => RealmFeedItemIDScalar,
      description: 'The feed item the comment belongs to',
    })
    feedItemId: number,
    @Args('parentCommentId', {
      type: () => RealmFeedItemCommentIDScalar,
      description: 'If the comment is a reply to another comment, the id of the parent comment',
      nullable: true,
    })
    parentCommentId: number | null,
    @Args('realm', {
      type: () => PublicKeyScalar,
      description: 'Public key of the realm the post belongs in',
    })
    realm: PublicKey,
    @CurrentEnvironment()
    environment: Environment,
    @CurrentUser() user: User,
  ) {
    return this.realmFeedItemCommentService.createComment({
      document,
      environment,
      feedItemId,
      parentCommentId,
      realmPublicKey: realm,
      requestingUser: user,
    });
  }

  @Query(() => RealmFeedItemCommentConnection, {
    description: 'A comment tree for a feed item',
  })
  @EitherResolver()
  feedItemCommentTree(
    @Args() args: ConnectionArgs,
    @Args('feedItemId', {
      type: () => RealmFeedItemIDScalar,
      description: 'The feed item the comment tree belongs to',
    })
    feedItemId: number,
    @CurrentEnvironment()
    environment: Environment,
    @CurrentUser() user: User,
    @Args('depth', {
      type: () => Number,
      defaultValue: 3,
      description: 'The tree depth. Min is 1',
      nullable: true,
    })
    depth = 3,
    @Args('sort', {
      type: () => RealmFeedItemCommentSort,
      description: 'Sort order for the comment tree',
      defaultValue: RealmFeedItemCommentSort.Relevance,
      nullable: true,
    })
    sort: RealmFeedItemCommentSort = RealmFeedItemCommentSort.Relevance,
  ) {
    if (depth < 1) {
      return TE.left(new errors.MalformedRequest());
    }

    return this.realmFeedItemCommentService.getCommentTreeForFeedItem({
      after: args.after ? (args.after as RealmFeedItemCommentCursor) : undefined,
      before: args.before ? (args.before as RealmFeedItemCommentCursor) : undefined,
      first: args.first,
      last: args.last,
      depth,
      environment,
      feedItemId,
      sort,
      requestingUser: user,
    });
  }

  @Mutation(() => RealmFeedItemComment, {
    description: 'Approve or disapprove a feed item comment',
  })
  @UseGuards(AuthJwtGuard)
  @EitherResolver()
  voteOnFeedItemComment(
    @Args('realm', {
      type: () => PublicKeyScalar,
      description: 'Public key of the realm the comment belongs in',
    })
    realm: PublicKey,
    @Args('commentId', {
      type: () => RealmFeedItemCommentIDScalar,
      description: 'The ID of the comment being voted on',
    })
    id: number,
    @Args('vote', {
      type: () => RealmFeedItemCommentVoteType,
      description: 'The type of vote',
    })
    vote: RealmFeedItemCommentVoteType,
    @CurrentEnvironment()
    environment: Environment,
    @CurrentUser() user: User | null,
  ) {
    return this.realmFeedItemCommentService.submitVote({
      environment,
      id,
      realmPublicKey: realm,
      requestingUser: user,
      type: vote,
    });
  }
}
