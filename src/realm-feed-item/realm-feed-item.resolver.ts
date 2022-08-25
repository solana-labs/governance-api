import { UseGuards } from '@nestjs/common';
import { Args, Resolver, Mutation, Query, ID } from '@nestjs/graphql';
import { PublicKey } from '@solana/web3.js';

import { CurrentEnvironment, Environment } from '@lib/decorators/CurrentEnvironment';
import { CurrentUser, User } from '@lib/decorators/CurrentUser';
import { AuthJwtGuard } from '@src/auth/auth.jwt.guard';
import { EitherResolver } from '@src/lib/decorators/EitherResolver';
import { PublicKeyScalar } from '@src/lib/scalars/PublicKey';

import { RealmFeedItem } from './dto/RealmFeedItem';
import { RealmFeedItemVoteType } from './dto/RealmFeedItemVoteType';

import { RealmFeedItemService } from './realm-feed-item.service';

@Resolver(() => RealmFeedItem)
export class RealmFeedItemResolver {
  constructor(private readonly realmFeedItemService: RealmFeedItemService) {}

  @Query(() => RealmFeedItem, {
    description: "An individual item in a Realm's feed",
  })
  @UseGuards(AuthJwtGuard)
  @EitherResolver()
  feedItem(
    @Args('realm', {
      type: () => PublicKeyScalar,
      description: 'Public key of the realm the feed item belongs in',
    })
    realm: PublicKey,
    @Args('id', {
      type: () => ID,
      description: 'ID of the feed item',
    })
    id: string,
    @CurrentEnvironment() environment: Environment,
    @CurrentUser() user: User | null,
  ) {
    return this.realmFeedItemService.getFeedItem(
      realm,
      parseInt(id, 10),
      user ? user.publicKey : null,
      environment,
    );
  }

  @Query(() => [RealmFeedItem], {
    description: 'A list of feed items that have been pinned',
  })
  @UseGuards(AuthJwtGuard)
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
    return this.realmFeedItemService.getPinnedFeedItems(
      realm,
      user ? user.publicKey : null,
      environment,
    );
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
      type: () => ID,
      description: 'The ID of the feed item being voted on',
    })
    id: string,
    @Args('vote', {
      type: () => RealmFeedItemVoteType,
      description: 'The type of vote',
    })
    vote: RealmFeedItemVoteType,
    @CurrentEnvironment()
    environment: Environment,
    @CurrentUser() user: User | null,
  ) {
    return this.realmFeedItemService.submitVote(realm, parseInt(id, 10), vote, user, environment);
  }
}
