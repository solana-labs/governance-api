import { Resolver, Query, Args, ResolveField, Root, Int } from '@nestjs/graphql';
import { PublicKey } from '@solana/web3.js';

import { CurrentEnvironment, Environment } from '@lib/decorators/CurrentEnvironment';
import { ConnectionArgs } from '@lib/gqlTypes/Connection';
import { EitherResolver } from '@src/lib/decorators/EitherResolver';
import { PublicKeyScalar } from '@src/lib/scalars/PublicKey';
import { RealmMemberSort, RealmMemberConnection } from '@src/realm-member/dto/pagination';
import { RealmMemberService, RealmMemberCursor } from '@src/realm-member/realm-member.service';

import { Realm } from './dto/Realm';
import { RealmService } from './realm.service';

@Resolver(() => Realm)
export class RealmResolver {
  constructor(
    private readonly realmService: RealmService,
    private readonly realmMemberService: RealmMemberService,
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
}
