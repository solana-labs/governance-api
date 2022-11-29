import { UseGuards } from '@nestjs/common';
import { Args, Int, Resolver, ResolveField, Root, Mutation, Query } from '@nestjs/graphql';
import { PublicKey } from '@solana/web3.js';
import * as EI from 'fp-ts/Either';
import * as FN from 'fp-ts/function';
import * as TE from 'fp-ts/TaskEither';

import { CurrentEnvironment, Environment } from '@lib/decorators/CurrentEnvironment';
import { CurrentUser, User } from '@lib/decorators/CurrentUser';
import { EitherResolver } from '@lib/decorators/EitherResolver';
import * as errors from '@lib/errors/gql';
import { PublicKeyScalar } from '@lib/scalars/PublicKey';
import { RichTextDocumentScalar } from '@lib/scalars/RichTextDocument';
import { RichTextDocument } from '@lib/types/RichTextDocument';
import { AuthJwtGuard } from '@src/auth/auth.jwt.guard';
import { ClippedRichTextDocument } from '@src/lib/gqlTypes/ClippedRichTextDocument';
import { ConnectionArgs } from '@src/lib/gqlTypes/Connection';
import { RealmFeedItemIDScalar } from '@src/lib/scalars/RealmFeedItemID';
import { clipRichTextDocument } from '@src/lib/textManipulation/clipRichTextDocument';
import { RealmFeedItemCommentConnection } from '@src/realm-feed-item-comment/dto/pagination';
import { RealmFeedItemCommentSort } from '@src/realm-feed-item-comment/dto/pagination';
import {
  RealmFeedItemCommentService,
  RealmFeedItemCommentCursor,
} from '@src/realm-feed-item-comment/realm-feed-item-comment.service';
import { Realm } from '@src/realm/dto/Realm';
import { RealmService } from '@src/realm/realm.service';

import { RealmFeedItem, RealmFeedItemPost, RealmFeedItemProposal } from './dto/RealmFeedItem';
import { RealmFeedItemVoteType } from './dto/RealmFeedItemVoteType';
import { RealmFeedItemService } from './realm-feed-item.service';

@Resolver(() => RealmFeedItemPost)
export class RealmFeedItemPostResolver {
  constructor(
    private readonly realmService: RealmService,
    private readonly realmFeedItemCommentService: RealmFeedItemCommentService,
  ) {}

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
    @Args('attachmentLimit', {
      type: () => Int,
      description: 'The maximum number of attachments to include',
      nullable: true,
      defaultValue: 0,
    })
    attachmentLimit = 0,
    @Root() post: RealmFeedItemPost,
  ) {
    return FN.pipe(
      EI.tryCatch(
        () => clipRichTextDocument(post.document, charLimit, attachmentLimit),
        (e) => new errors.Exception(e),
      ),
    );
  }

  @ResolveField(() => RealmFeedItemCommentConnection, {
    description: 'The comment tree for this post',
  })
  @EitherResolver()
  commentTree(
    @Args() args: ConnectionArgs,
    @Root() post: RealmFeedItemPost,
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
      sort,
      feedItemId: post.id,
      requestingUser: user,
    });
  }

  @ResolveField(() => Number, {
    description: 'A count of comments in the post',
  })
  @EitherResolver()
  numComments(
    @Root() post: RealmFeedItemPost,
    @CurrentEnvironment()
    environment: Environment,
  ) {
    return this.realmFeedItemCommentService.getCommentCountForFeedItem({
      environment,
      feedItemId: post.id,
    });
  }

  @ResolveField(() => Realm, {
    description: 'The realm the post is in',
  })
  realm(
    @Root() post: RealmFeedItemPost,
    @CurrentEnvironment()
    environment: Environment,
  ) {
    return this.realmService.getRealm(post.realmPublicKey, environment);
  }
}

@Resolver(() => RealmFeedItemProposal)
export class RealmFeedItemProposalResolver {
  constructor(
    private readonly realmService: RealmService,
    private readonly realmFeedItemCommentService: RealmFeedItemCommentService,
  ) {}

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
    @Args('attachmentLimit', {
      type: () => Int,
      description: 'The maximum number of attachments to include',
      nullable: true,
      defaultValue: 0,
    })
    attachmentLimit = 0,
    @Root() proposal: RealmFeedItemProposal,
  ) {
    return FN.pipe(
      EI.tryCatch(
        () => clipRichTextDocument(proposal.document, charLimit, attachmentLimit),
        (e) => new errors.Exception(e),
      ),
    );
  }

  @ResolveField(() => RealmFeedItemCommentConnection, {
    description: 'The comment tree for this proposal',
  })
  @EitherResolver()
  commentTree(
    @Args() args: ConnectionArgs,
    @Root() proposal: RealmFeedItemProposal,
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
      sort,
      feedItemId: proposal.id,
      requestingUser: user,
    });
  }

  @ResolveField(() => Number, {
    description: 'A count of comments in the proposal',
  })
  @EitherResolver()
  numComments(
    @Root() proposal: RealmFeedItemProposal,
    @CurrentEnvironment()
    environment: Environment,
  ) {
    return this.realmFeedItemCommentService.getCommentCountForFeedItem({
      environment,
      feedItemId: proposal.id,
    });
  }

  @ResolveField(() => Realm, {
    description: 'The realm the proposal is in',
  })
  realm(
    @Root() proposal: RealmFeedItemProposal,
    @CurrentEnvironment()
    environment: Environment,
  ) {
    return this.realmService.getRealm(proposal.realmPublicKey, environment);
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
    id: number,
    @CurrentEnvironment() environment: Environment,
    @CurrentUser() user: User | null,
  ) {
    return this.realmFeedItemService.getFeedItem(realm, id, user, environment);
  }

  @Query(() => [RealmFeedItem], {
    description: 'A list of feed items',
  })
  feedItems(
    @Args('ids', {
      type: () => [RealmFeedItemIDScalar],
      description: 'ID of the feed item',
    })
    ids: number[],
    @CurrentEnvironment() environment: Environment,
    @CurrentUser() user: User | null,
  ) {
    return this.realmFeedItemService.getFeedItems(ids, user, environment);
  }

  @Query(() => [RealmFeedItem], {
    description: 'A list of feed items that have been pinned',
  })
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
    @Args('crosspostTo', {
      type: () => [PublicKeyScalar],
      description: 'Optional realms to crosspost to',
      nullable: true,
    })
    crosspostTo?: null | PublicKey[],
  ) {
    return this.realmFeedItemService.createPost({
      crosspostTo,
      document,
      environment,
      title,
      requestingUser: user,
      realmPublicKey: realm,
    });
  }

  @Mutation(() => Boolean, {
    description: 'Delete a post',
  })
  @UseGuards(AuthJwtGuard)
  deletePost(
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
    @CurrentEnvironment()
    environment: Environment,
    @CurrentUser() user: User | null,
  ) {
    if (!user) {
      throw new errors.Unauthorized();
    }

    return this.realmFeedItemService.deletePost({
      environment,
      id,
      realmPublicKey: realm,
      requestingUser: user,
    });
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
