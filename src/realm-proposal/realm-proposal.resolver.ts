import { Resolver, Query, Args } from '@nestjs/graphql';
import { PublicKey } from '@solana/web3.js';

import { CurrentEnvironment, Environment } from '@lib/decorators/CurrentEnvironment';
import { CurrentUser, User } from '@lib/decorators/CurrentUser';
import { EitherResolver } from '@lib/decorators/EitherResolver';
import { ConnectionArgs } from '@lib/gqlTypes/Connection';
import { PublicKeyScalar } from '@lib/scalars/PublicKey';

import { RealmProposalConnection, RealmProposalSort } from './dto/pagination';
import { RealmProposalGQLService, RealmProposalCursor } from './realm-proposal.gql.service';

@Resolver()
export class RealmProposalResolver {
  constructor(private readonly realmProposalGQLService: RealmProposalGQLService) {}

  @Query(() => RealmProposalConnection, {
    description: 'A list of proposals for a Realm',
  })
  @EitherResolver()
  proposals(
    @Args() args: ConnectionArgs,
    @Args('realm', {
      description: 'Public key of the Realm',
      type: () => PublicKeyScalar,
    })
    realm: PublicKey,
    @Args('sort', {
      type: () => RealmProposalSort,
      description: 'Sort order for the list',
      defaultValue: RealmProposalSort.Time,
      nullable: true,
    })
    sort: RealmProposalSort = RealmProposalSort.Alphabetical,
    @CurrentEnvironment() environment: Environment,
    @CurrentUser() user: User | null,
  ) {
    return this.realmProposalGQLService.getGQLProposalList(
      realm,
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
