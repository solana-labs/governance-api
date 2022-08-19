import { Resolver, Query, Args } from '@nestjs/graphql';
import { PublicKey } from '@solana/web3.js';

import { CurrentEnvironment, Environment } from '@lib/decorators/CurrentEnvironment';
import { EitherResolver } from '@lib/decorators/EitherResolver';
import { PublicKeyScalar } from '@lib/scalars/PublicKey';

import { RealmProposal } from './dto/RealmProposal';
import { RealmProposalService } from './realm-proposal.service';

@Resolver()
export class RealmProposalResolver {
  constructor(private readonly realmProposalService: RealmProposalService) {}

  @Query(() => [RealmProposal], {
    description: 'A list of proposals for a Realm',
  })
  @EitherResolver()
  proposals(
    @Args('realm', {
      description: 'Public key of the Realm',
      type: () => PublicKeyScalar,
    })
    realm: PublicKey,
    @CurrentEnvironment() environment: Environment,
  ) {
    return this.realmProposalService.getProposalsForRealm(realm, environment);
  }
}
