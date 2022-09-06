import { UseGuards } from '@nestjs/common';
import { Args, Int, Resolver, ResolveField, Root, Mutation, Query } from '@nestjs/graphql';
import { PublicKey } from '@solana/web3.js';
import * as EI from 'fp-ts/Either';
import * as FN from 'fp-ts/function';

import { CurrentEnvironment, Environment } from '@lib/decorators/CurrentEnvironment';
import { CurrentUser, User } from '@lib/decorators/CurrentUser';
import { EitherResolver } from '@lib/decorators/EitherResolver';
import * as errors from '@lib/errors/gql';
import { PublicKeyScalar } from '@lib/scalars/PublicKey';
import { RichTextDocumentScalar } from '@lib/scalars/RichTextDocument';
import { RichTextDocument } from '@lib/types/RichTextDocument';
import { AuthJwtGuard } from '@src/auth/auth.jwt.guard';
import { ClippedRichTextDocument } from '@src/lib/gqlTypes/ClippedRichTextDocument';
import { RealmFeedItemIDScalar } from '@src/lib/scalars/RealmFeedItemID';
import { clipRichTextDocument } from '@src/lib/textManipulation/clipRichTextDocument';

import { RealmFeedItem, RealmFeedItemPost, RealmFeedItemProposal } from './dto/RealmFeedItem';
import { RealmFeedItemVoteType } from './dto/RealmFeedItemVoteType';
import { RealmFeedItemService } from './realm-feed-item.service';

@Resolver(() => RealmFeedItemPost)
export class RealmFeedItemPostResolver {
  @ResolveField(() => ClippedRichTextDocument, {
    description: 'A clipped version of the post document',
  })
  @EitherResolver()
  clippedDocument(
    @Args('charLimit', {
      type: () => Int,
      description: 'The character count to clip the document at',
      nullable: true,
      defaultValue: 400,
    })
    charLimit = 400,
    @Root() post: RealmFeedItemPost,
  ) {
    return FN.pipe(
      EI.tryCatch(
        () => clipRichTextDocument(post.document, charLimit),
        (e) => new errors.Exception(e),
      ),
    );
  }
}

@Resolver(() => RealmFeedItemProposal)
export class RealmFeedItemProposalResolver {
  @ResolveField(() => ClippedRichTextDocument, {
    description: 'A clipped version of the proposal document',
  })
  @EitherResolver()
  clippedDocument(
    @Args('charLimit', {
      type: () => Int,
      description: 'The character count to clip the document at',
      nullable: true,
      defaultValue: 400,
    })
    charLimit = 400,
    @Root() proposal: RealmFeedItemProposal,
  ) {
    return FN.pipe(
      EI.tryCatch(
        () => clipRichTextDocument(proposal.document, charLimit),
        (e) => new errors.Exception(e),
      ),
    );
  }
}

@Resolver(() => RealmFeedItem)
export class RealmFeedItemResolver {
  constructor(private readonly realmFeedItemService: RealmFeedItemService) {}

  @Query(() => RealmFeedItem, {
    description: "An individual item in a Realm's feed",
  })
  @EitherResolver()
  feedItem(
    @Args('realm', {
      type: () => PublicKeyScalar,
      description: 'Public key of the realm the feed item belongs in',
    })
    realm: PublicKey,
    @Args('id', {
      type: () => RealmFeedItemIDScalar,
      description: 'ID of the feed item',
    })
    id: string,
    @CurrentEnvironment() environment: Environment,
    @CurrentUser() user: User | null,
  ) {
    return this.realmFeedItemService.getFeedItem(realm, parseInt(id, 10), user, environment);
  }

  @Query(() => [RealmFeedItem], {
    description: 'A list of feed items that have been pinned',
  })
  @EitherResolver()
  pinnedFeedItems(
    @Args('realm', {
      type: () => PublicKeyScalar,
      description: 'Public key of the realm the feed item belongs in',
    })
    realm: PublicKey,
    @CurrentEnvironment() environment: Environment,
    @CurrentUser() user: User | null,
  ) {
    return this.realmFeedItemService.getPinnedFeedItems(realm, user, environment);
  }

  @Mutation(() => RealmFeedItemPost, {
    description: 'Create a new Post',
  })
  @UseGuards(AuthJwtGuard)
  @EitherResolver()
  createPost(
    @Args('document', {
      type: () => RichTextDocumentScalar,
      description: 'Post content',
    })
    document: RichTextDocument,
    @Args('realm', {
      type: () => PublicKeyScalar,
      description: 'Public key of the realm the post belongs in',
    })
    realm: PublicKey,
    @Args('title', {
      type: () => String,
      description: 'Title of the post',
    })
    title: string,
    @CurrentEnvironment()
    environment: Environment,
    @CurrentUser() user: User | null,
  ) {
    return this.realmFeedItemService.createPost(realm, title, document, user, environment);
  }

  @Mutation(() => RealmFeedItem, {
    description: 'Approve or disapprove a feed item',
  })
  @UseGuards(AuthJwtGuard)
  @EitherResolver()
  voteOnFeedItem(
    @Args('realm', {
      type: () => PublicKeyScalar,
      description: 'Public key of the realm the feed item belongs in',
    })
    realm: PublicKey,
    @Args('feedItemId', {
      type: () => RealmFeedItemIDScalar,
      description: 'The ID of the feed item being voted on',
    })
    id: number,
    @Args('vote', {
      type: () => RealmFeedItemVoteType,
      description: 'The type of vote',
    })
    vote: RealmFeedItemVoteType,
    @CurrentEnvironment()
    environment: Environment,
    @CurrentUser() user: User | null,
  ) {
    return this.realmFeedItemService.submitVote(realm, id, vote, user, environment);
  }
}
