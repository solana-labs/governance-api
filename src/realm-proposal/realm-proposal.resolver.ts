import { Resolver, Query, Args } from '@nestjs/graphql';
import { PublicKey } from '@solana/web3.js';

import { CurrentEnvironment, Environment } from '@lib/decorators/CurrentEnvironment';
import { EitherResolver } from '@lib/decorators/EitherResolver';
import { ConnectionArgs } from '@lib/gqlTypes/Connection';
import { PublicKeyScalar } from '@lib/scalars/PublicKey';

import { RealmProposalConnection, RealmProposalSort } from './dto/pagination';
import { RealmProposalService, RealmProposalCursor } from './realm-proposal.service';

@Resolver()
export class RealmProposalResolver {
  constructor(private readonly realmProposalService: RealmProposalService) {}

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
  ) {
    return this.realmProposalService.getGQLProposalList(
      realm,
      sort,
      environment,
      args.after as RealmProposalCursor | undefined,
      args.before as RealmProposalCursor | undefined,
      args.first,
      args.last,
    );
  }
}
