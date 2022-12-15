import { Args, Mutation, Resolver, Query, ResolveField, Root } from '@nestjs/graphql';

import { CurrentEnvironment, Environment } from '@lib/decorators/CurrentEnvironment';
import { CurrentUser, User } from '@lib/decorators/CurrentUser';
import * as errors from '@lib/errors/gql';
import { ConfigService } from '@src/config/config.service';
import { Realm } from '@src/realm/dto/Realm';
import { RealmService } from '@src/realm/realm.service';

import { DiscoverPageService } from './discover-page.service';
import { DiscoverPage } from './dto/DiscoverPage';
import { DiscoverPageSpotlightItem } from './dto/DiscoverPageSpotlightItem';
import { DiscoverPageInput } from './inputDto/DiscoverPageInput';

@Resolver(() => DiscoverPage)
export class DiscoverPageResolver {
  constructor(
    private readonly configService: ConfigService,
    private readonly discoverPageService: DiscoverPageService,
  ) {}

  @Query(() => DiscoverPage, {
    description: 'The discover page',
  })
  discoverPage(@CurrentEnvironment() environment: Environment) {
    return this.discoverPageService.getCurrentDiscoverPage(environment);
  }

  @Mutation(() => DiscoverPage, {
    description: 'Update the Discover Page',
  })
  updateDiscoverPage(
    @Args('data', {
      type: () => DiscoverPageInput,
      description: 'A new discover page',
    })
    data: DiscoverPageInput,
    @CurrentEnvironment()
    environment: Environment,
    @CurrentUser() user: User | null,
  ) {
    if (!user) {
      throw new errors.Unauthorized();
    }

    if (
      !this.configService.get('constants.admins').some((adminPk) => adminPk.equals(user.publicKey))
    ) {
      throw new errors.Unauthorized();
    }

    return this.discoverPageService.updateDiscoverPage(
      {
        daoToolingPublicKeyStrs: data.daoTooling.map((pk) => pk.toBase58()),
        defiPublicKeyStrs: data.defi.map((pk) => pk.toBase58()),
        gamingPublicKeyStrs: data.gaming.map((pk) => pk.toBase58()),
        hackathonWinnersPublicKeyStrs: data.hackathonWinners.map((pk) => pk.toBase58()),
        keyAnnouncementFeedItemIds: data.keyAnnouncements,
        nftCollectionsPublicKeyStrs: data.nftCollections.map((pk) => pk.toBase58()),
        popularPublicKeyStrs: data.popular.map((pk) => pk.toBase58()),
        spotlight: data.spotlight.map((s) => ({
          heroImageUrl: s.heroImageUrl,
          title: s.title,
          realmPublicKeyStr: s.publicKey.toBase58(),
          description: s.description,
          stats: s.stats,
        })),
        trendingOrgPublicKeyStrs: data.trending.map((pk) => pk.toBase58()),
        web3PublicKeyStrs: data.web3.map((pk) => pk.toBase58()),
      },
      environment,
    );
  }
}

@Resolver(() => DiscoverPageSpotlightItem)
export class DiscoverPageSpotlightItemResolver {
  constructor(private readonly realmService: RealmService) {}

  @ResolveField(() => Realm, {
    description: 'Realm associated with the Spotlight item',
  })
  realm(
    @Root() item: DiscoverPageSpotlightItem,
    @CurrentEnvironment()
    environment: Environment,
  ) {
    return this.realmService.getRealm(item.publicKey, environment);
  }
}
