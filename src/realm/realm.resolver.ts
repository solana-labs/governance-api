import { Resolver, Query, Args, ResolveField, Root, Int } from '@nestjs/graphql';
import { PublicKey } from '@solana/web3.js';

import { CurrentEnvironment, Environment } from '@lib/decorators/CurrentEnvironment';
import { CurrentUser, User } from '@lib/decorators/CurrentUser';
import { ConnectionArgs } from '@lib/gqlTypes/Connection';
import { EitherResolver } from '@src/lib/decorators/EitherResolver';
import { PublicKeyScalar } from '@src/lib/scalars/PublicKey';
import { RealmMemberSort, RealmMemberConnection } from '@src/realm-member/dto/pagination';
import { RealmMemberService, RealmMemberCursor } from '@src/realm-member/realm-member.service';
import { RealmProposalSort, RealmProposalConnection } from '@src/realm-proposal/dto/pagination';
import {
  RealmProposalGQLService,
  RealmProposalCursor,
} from '@src/realm-proposal/realm-proposal.gql.service';

import { Realm } from './dto/Realm';
import { RealmService } from './realm.service';

@Resolver(() => Realm)
export class RealmResolver {
  constructor(
    private readonly realmMemberService: RealmMemberService,
    private readonly realmProposalGqlService: RealmProposalGQLService,
    private readonly realmService: RealmService,
  ) {}

  @Query(() => Realm, {
    description: 'A Realm',
  })
  @EitherResolver()
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
      user ? new PublicKey(user.publicKeyStr) : null,
      sort,
      environment,
      args.after as RealmProposalCursor | undefined,
      args.before as RealmProposalCursor | undefined,
      args.first,
      args.last,
    );
  }
}
