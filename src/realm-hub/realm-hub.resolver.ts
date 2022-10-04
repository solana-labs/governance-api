import { Args, Query, ResolveField, Resolver, Root } from '@nestjs/graphql';
import { PublicKey } from '@solana/web3.js';
import * as EI from 'fp-ts/Either';

import { CurrentEnvironment, Environment } from '@lib/decorators/CurrentEnvironment';
import { PublicKeyScalar } from '@lib/scalars/PublicKey';
import { abbreviateAddress } from '@lib/textManipulation/abbreviateAddress';
import { RealmTreasuryService } from '@src/realm-treasury/realm-treasury.service';

import { RealmHub } from './dto/RealmHub';
import { RealmHubInfo } from './dto/RealmHubInfo';
import { RealmHubInfoTokenDetails } from './dto/RealmHubInfoTokenDetails';
import { RealmHubService } from './realm-hub.service';

@Resolver(() => RealmHub)
export class RealmHubResolver {
  constructor(private readonly realmHubService: RealmHubService) {}

  @ResolveField(() => RealmHubInfo, {
    description: 'Info for the Realm',
  })
  info(@Root() hub: RealmHub, @CurrentEnvironment() environment: Environment) {
    return this.realmHubService.getCodeCommittedHubInfoForRealm(hub.realm, environment);
  }

  @ResolveField(() => Number, {
    description: 'Number of twitter followers',
  })
  twitterFollowerCount(@Root() hub: RealmHub, @CurrentEnvironment() environment: Environment) {
    return this.realmHubService.getTwitterFollowerCount(hub.realm, environment);
  }

  @Query(() => RealmHub, {
    description: 'A Realm Hub',
  })
  hub(
    @Args('realm', {
      description: 'The public key of the Realm the hub belongs to',
      type: () => PublicKeyScalar,
    })
    realm: PublicKey,
  ) {
    return { realm };
  }
}

@Resolver(() => RealmHubInfoTokenDetails)
export class RealmHubInfoTokenDetailsResolver {
  constructor(
    private readonly realmHubService: RealmHubService,
    private readonly realmTreasuryService: RealmTreasuryService,
  ) {}

  @ResolveField(() => Number, {
    description: 'Current price of the token',
  })
  async price(
    @Root() token: RealmHubInfoTokenDetails,
    @CurrentEnvironment() environment: Environment,
  ) {
    const price = await this.realmTreasuryService.getTokenPrice(token.mint, environment)();

    if (EI.isLeft(price)) {
      throw price.left;
    }

    return price.right;
  }

  @ResolveField(() => String, {
    description: 'Symbol for the token',
  })
  async symbol(
    @Root() token: RealmHubInfoTokenDetails,
    @CurrentEnvironment() environment: Environment,
  ) {
    const allTokens = await this.realmTreasuryService.fetchTokenListDict(environment)();

    if (EI.isLeft(allTokens)) {
      throw allTokens.left;
    }

    const tokenDetails = allTokens.right[token.mint.toBase58()];
    return tokenDetails?.symbol || abbreviateAddress(token.mint);
  }
}
