import { Args, Resolver, Query } from '@nestjs/graphql';
import { PublicKey } from '@solana/web3.js';

import { ConnectionArgs } from '@lib/gqlTypes/Connection';
import { PublicKeyScalar } from '@lib/scalars/PublicKey';
import { CurrentEnvironment, Environment } from '@src/lib/decorators/CurrentEnvironment';
import { EitherResolver } from '@src/lib/decorators/EitherResolver';

import { RealmMemberConnection, RealmMemberSort } from './dto/pagination';
import { RealmMemberService, RealmMemberCursor } from './realm-member.service';

@Resolver()
export class RealmMemberResolver {
  constructor(private readonly realmMemberService: RealmMemberService) {}

  @Query(() => RealmMemberConnection, {
    description: 'List of members in a Realm',
  })
  @EitherResolver()
  members(
    @Args() args: ConnectionArgs,
    @Args('realm', {
      type: () => PublicKeyScalar,
      description: 'Public key of the Realm',
    })
    realm: PublicKey,
    @Args('sort', {
      type: () => RealmMemberSort,
      description: 'Sort order for the list',
      defaultValue: RealmMemberSort.Alphabetical,
      nullable: true,
    })
    sort: RealmMemberSort = RealmMemberSort.Alphabetical,
    @CurrentEnvironment() environment: Environment,
  ) {
    return this.realmMemberService.getGQLMemberList(
      realm,
      sort,
      environment,
      args.after as RealmMemberCursor | undefined,
      args.before as RealmMemberCursor | undefined,
      args.first,
      args.last,
    );
  }
}
