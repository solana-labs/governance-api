import { UseGuards } from '@nestjs/common';
import { Args, Resolver, Mutation } from '@nestjs/graphql';
import { PublicKey } from '@solana/web3.js';

import { CurrentEnvironment, Environment } from '@lib/decorators/CurrentEnvironment';
import { CurrentUser, User } from '@lib/decorators/CurrentUser';
import { EitherResolver } from '@lib/decorators/EitherResolver';
import * as errors from '@lib/errors/gql';
import { PublicKeyScalar } from '@lib/scalars/PublicKey';
import { RichTextDocumentScalar } from '@lib/scalars/RichTextDocument';
import { RichTextDocument } from '@lib/types/RichTextDocument';
import { AuthJwtGuard } from '@src/auth/auth.jwt.guard';
import { RealmFeedItemCommentIDScalar } from '@src/lib/scalars/RealmFeedItemCommentID';
import { RealmFeedItemIDScalar } from '@src/lib/scalars/RealmFeedItemID';

import { RealmFeedItemComment } from './dto/RealmFeedItemComment';
import { RealmFeedItemCommentService } from './realm-feed-item-comment.service';

@Resolver(() => RealmFeedItemComment)
export class RealmFeedItemCommentResolver {
  constructor(private readonly realmFeedItemCommentService: RealmFeedItemCommentService) {}

  @Mutation(() => RealmFeedItemComment, {
    description: 'Create a new comment for a feed item',
  })
  @UseGuards(AuthJwtGuard)
  @EitherResolver()
  createComment(
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
}
