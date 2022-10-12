import { Resolver, Query, Args, ResolveField, Root, Int } from '@nestjs/graphql';
import { PublicKey } from '@solana/web3.js';

import { CurrentEnvironment, Environment } from '@lib/decorators/CurrentEnvironment';
import { CurrentUser, User } from '@lib/decorators/CurrentUser';
import { ConnectionArgs } from '@lib/gqlTypes/Connection';
import { EitherResolver } from '@src/lib/decorators/EitherResolver';
import { PublicKeyScalar } from '@src/lib/scalars/PublicKey';
import { RealmFeedItemSort, RealmFeedItemConnection } from '@src/realm-feed-item/dto/pagination';
import { RealmFeedItem } from '@src/realm-feed-item/dto/RealmFeedItem';
import {
  RealmFeedItemGQLService,
  RealmFeedItemCursor,
} from '@src/realm-feed-item/realm-feed-item.gql.service';
import { RealmFeedItemService } from '@src/realm-feed-item/realm-feed-item.service';
import { RealmHub } from '@src/realm-hub/dto/RealmHub';
import { RealmMemberSort, RealmMemberConnection } from '@src/realm-member/dto/pagination';
import { RealmMemberService, RealmMemberCursor } from '@src/realm-member/realm-member.service';
import { RealmProposalSort, RealmProposalConnection } from '@src/realm-proposal/dto/pagination';
import {
  RealmProposalGQLService,
  RealmProposalCursor,
} from '@src/realm-proposal/realm-proposal.gql.service';
import { RealmTreasury } from '@src/realm-treasury/dto/RealmTreasury';

import { Realm } from './dto/Realm';
import { RealmService } from './realm.service';

@Resolver(() => Realm)
export class RealmResolver {
  constructor(
    private readonly realmFeedItemGQLService: RealmFeedItemGQLService,
    private readonly realmFeedItemService: RealmFeedItemService,
    private readonly realmMemberService: RealmMemberService,
    private readonly realmProposalGqlService: RealmProposalGQLService,
    private readonly realmService: RealmService,
  ) {}

  @ResolveField(() => RealmFeedItemConnection, {
    description: 'Realm feed',
  })
  @EitherResolver()
  feed(
    @Args() args: ConnectionArgs,
    @Args('sort', {
      type: () => RealmFeedItemSort,
      description: 'Sort order for the feed',
      defaultValue: RealmFeedItemSort.Relevance,
      nullable: true,
    })
    sort: RealmFeedItemSort = RealmFeedItemSort.Relevance,
    @Root() realm: Realm,
    @CurrentEnvironment() environment: Environment,
    @CurrentUser() user: User | null,
  ) {
    return this.realmFeedItemGQLService.getGQLFeedItemsList(
      realm.publicKey,
      user,
      sort,
      environment,
      args.after as RealmFeedItemCursor | undefined,
      args.before as RealmFeedItemCursor | undefined,
      args.first,
      args.last,
    );
  }

  @ResolveField(() => RealmHub, {
    description: 'The hub for this Realm',
  })
  hub(@Root() realm: Realm) {
    return { realm: realm.publicKey };
  }

  @ResolveField(() => [RealmFeedItem], {
    description: 'A list of pinned feed items',
  })
  @EitherResolver()
  pinnedFeedItems(
    @Root() realm: Realm,
    @CurrentEnvironment() environment: Environment,
    @CurrentUser() user: User | null,
  ) {
    return this.realmFeedItemService.getPinnedFeedItems(realm.publicKey, user, environment);
  }

  @Query(() => Realm, {
    description: 'A Realm',
  })
  realm(
    @Args('publicKey', {
      description: 'The public key of the Realm',
      type: () => PublicKeyScalar,
    })
    publicKey: PublicKey,
    @CurrentEnvironment() environment: Environment,
  ) {
    return this.realmService.getRealm(publicKey, environment);
  }

  @ResolveField(() => RealmMemberConnection, {
    description: 'List of members in the realm',
  })
  @EitherResolver()
  members(
    @Args() args: ConnectionArgs,
    @Args('sort', {
      type: () => RealmMemberSort,
      description: 'Sort order for the list',
      defaultValue: RealmMemberSort.Alphabetical,
      nullable: true,
    })
    sort: RealmMemberSort = RealmMemberSort.Alphabetical,
    @Root() realm: Realm,
    @CurrentEnvironment() environment: Environment,
  ) {
    return this.realmMemberService.getGQLMemberList(
      realm.publicKey,
      sort,
      environment,
      args.after as RealmMemberCursor | undefined,
      args.before as RealmMemberCursor | undefined,
      args.first,
      args.last,
    );
  }

  @ResolveField(() => Int, {
    description: 'Count of the number of members in this Realm',
  })
  @EitherResolver()
  membersCount(@Root() realm: Realm, @CurrentEnvironment() environment: Environment) {
    return this.realmMemberService.getMembersCountForRealm(realm.publicKey, environment);
  }

  @ResolveField(() => RealmProposalConnection, {
    description: 'List of proposals in the realm',
  })
  @EitherResolver()
  proposals(
    @Args() args: ConnectionArgs,
    @Args('sort', {
      type: () => RealmProposalSort,
      description: 'Sort order for the list',
      defaultValue: RealmProposalSort.Time,
      nullable: true,
    })
    sort: RealmProposalSort = RealmProposalSort.Time,
    @Root() realm: Realm,
    @CurrentEnvironment() environment: Environment,
    @CurrentUser() user: User | null,
  ) {
    return this.realmProposalGqlService.getGQLProposalList(
      realm.publicKey,
      user ? user.publicKey : null,
      sort,
      environment,
      args.after as RealmProposalCursor | undefined,
      args.before as RealmProposalCursor | undefined,
      args.first,
      args.last,
    );
  }

  @ResolveField(() => RealmTreasury, {
    description: "The realm's treasury",
  })
  treasury(@Root() realm: Realm) {
    return { belongsTo: realm.publicKey };
  }
}
