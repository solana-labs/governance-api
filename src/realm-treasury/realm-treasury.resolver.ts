import { Args, ResolveField, Resolver, Root, Query } from '@nestjs/graphql';
import { PublicKey } from '@solana/web3.js';

import { CurrentEnvironment, Environment } from '@lib/decorators/CurrentEnvironment';
import { EitherResolver } from '@lib/decorators/EitherResolver';
import { PublicKeyScalar } from '@lib/scalars/PublicKey';
import { BigNumberScalar } from '@src/lib/scalars/BigNumber';

import { RealmTreasury } from './dto/RealmTreasury';
import { RealmTreasuryService } from './realm-treasury.service';

@Resolver(() => RealmTreasury)
export class RealmTreasuryResolver {
  constructor(private readonly realmTreasuryService: RealmTreasuryService) {}

  @Query(() => RealmTreasury, {
    description: "A realm's treasury",
  })
  realmTreasury(
    @Args('realm', {
      type: () => PublicKeyScalar,
      description: 'A realm',
    })
    realm: PublicKey,
  ) {
    return { belongsTo: realm };
  }

  @ResolveField(() => BigNumberScalar, {
    description: 'The total value of the treasury',
  })
  @EitherResolver()
  totalValue(@Root() realmTreasury: RealmTreasury, @CurrentEnvironment() environment: Environment) {
    return this.realmTreasuryService.getRealmTreasuryValue(realmTreasury.belongsTo, environment);
  }
}
