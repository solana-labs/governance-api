import { UseGuards } from '@nestjs/common';
import { Args, Resolver, Query } from '@nestjs/graphql';
import { PublicKey } from '@solana/web3.js';

import { CurrentEnvironment, Environment } from '@lib/decorators/CurrentEnvironment';
import { CurrentUser, User } from '@lib/decorators/CurrentUser';
import { EitherResolver } from '@lib/decorators/EitherResolver';
import { ConnectionArgs } from '@lib/gqlTypes/Connection';
import { PublicKeyScalar } from '@lib/scalars/PublicKey';
import { AuthJwtGuard } from '@src/auth/auth.jwt.guard';
import { RealmFeedItemConnection, RealmFeedItemSort } from '@src/realm-feed-item/dto/pagination';
import {
  RealmFeedItemGQLService,
  RealmFeedItemCursor,
} from '@src/realm-feed-item/realm-feed-item.gql.service';

import { RealmFeedService } from './realm-feed.service';

@Resolver()
export class RealmFeedResolver {
  constructor(
    private readonly realmFeedService: RealmFeedService,
    private readonly realmFeedItemGQLService: RealmFeedItemGQLService,
  ) {}

  @Query(() => RealmFeedItemConnection, {
    description: 'A feed for a Realm',
  })
  @EitherResolver()
  @UseGuards(AuthJwtGuard)
  feed(
    @Args() args: ConnectionArgs,
    @Args('realm', {
      description: 'Public key of the Realm',
      type: () => PublicKeyScalar,
    })
    realm: PublicKey,
    @Args('sort', {
      type: () => RealmFeedItemSort,
      description: 'Sort order for the feed',
      defaultValue: RealmFeedItemSort.Relevance,
      nullable: true,
    })
    sort: RealmFeedItemSort = RealmFeedItemSort.Relevance,
    @CurrentEnvironment() environment: Environment,
    @CurrentUser() user: User | null,
  ) {
    return this.realmFeedItemGQLService.getGQLFeedItemsList(
      realm,
      user ? user.publicKey : null,
      sort,
      environment,
      args.after as RealmFeedItemCursor | undefined,
      args.before as RealmFeedItemCursor | undefined,
      args.first,
      args.last,
    );
  }
}
