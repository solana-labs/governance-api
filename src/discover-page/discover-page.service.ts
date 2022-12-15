import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PublicKey } from '@solana/web3.js';
import { In, Repository } from 'typeorm';

import { Environment } from '@lib/types/Environment';
import { RealmFeedItemService } from '@src/realm-feed-item/realm-feed-item.service';
import { RealmService } from '@src/realm/realm.service';

import { DiscoverPage } from './dto/DiscoverPage';
import { DiscoverPage as DiscoverPageEntity, Data } from './entities/DiscoverPage.entity';

interface DiscoverPageData extends Data {
  version: number;
}

@Injectable()
export class DiscoverPageService {
  constructor(
    @InjectRepository(DiscoverPageEntity)
    private readonly discoverPageRepository: Repository<DiscoverPageEntity>,
    private readonly realmFeedItemService: RealmFeedItemService,
    private readonly realmService: RealmService,
  ) {}

  async getCurrentDiscoverPageData(environment: Environment) {
    const discoverPage = (
      await this.discoverPageRepository
        .createQueryBuilder('discoverPage')
        .where('environment = :environment', { environment })
        .orderBy({ id: 'DESC' })
        .limit(1)
        .getMany()
    )[0];

    if (!discoverPage) {
      const defaultData: DiscoverPageData = {
        version: -1,
        daoToolingPublicKeyStrs: [],
        defiPublicKeyStrs: [],
        gamingPublicKeyStrs: [],
        hackathonWinnersPublicKeyStrs: [],
        keyAnnouncementFeedItemIds: [],
        nftCollectionsPublicKeyStrs: [],
        popularPublicKeyStrs: [],
        spotlight: [],
        trendingOrgPublicKeyStrs: [],
        web3PublicKeyStrs: [],
      };

      return defaultData;
    }

    return {
      ...discoverPage.data,
      version: discoverPage.id,
    };
  }

  async getCurrentDiscoverPage(environment: Environment) {
    const data = await this.getCurrentDiscoverPageData(environment);

    const [
      daoTooling,
      defi,
      gaming,
      hackathonWinners,
      keyAnnouncements,
      nftCollections,
      popular,
      trending,
      web3,
    ] = await Promise.all([
      this.realmService.getRealms(
        data.daoToolingPublicKeyStrs.map((p) => new PublicKey(p)),
        environment,
      ),
      this.realmService.getRealms(
        data.defiPublicKeyStrs.map((p) => new PublicKey(p)),
        environment,
      ),
      this.realmService.getRealms(
        data.gamingPublicKeyStrs.map((p) => new PublicKey(p)),
        environment,
      ),
      this.realmService.getRealms(
        data.hackathonWinnersPublicKeyStrs.map((p) => new PublicKey(p)),
        environment,
      ),
      this.realmFeedItemService.getFeedItems(data.keyAnnouncementFeedItemIds, null, environment),
      this.realmService.getRealms(
        data.nftCollectionsPublicKeyStrs.map((p) => new PublicKey(p)),
        environment,
      ),
      this.realmService.getRealms(
        data.popularPublicKeyStrs.map((p) => new PublicKey(p)),
        environment,
      ),
      this.realmService.getRealms(
        data.trendingOrgPublicKeyStrs.map((p) => new PublicKey(p)),
        environment,
      ),
      this.realmService.getRealms(
        data.web3PublicKeyStrs.map((p) => new PublicKey(p)),
        environment,
      ),
    ]);

    const discoverPage: DiscoverPage = {
      keyAnnouncements,
      daoTooling: daoTooling.map(this.realmService.convertEntityDto),
      defi: defi.map(this.realmService.convertEntityDto),
      gaming: gaming.map(this.realmService.convertEntityDto),
      hackathonWinners: hackathonWinners.map(this.realmService.convertEntityDto),
      nftCollections: nftCollections.map(this.realmService.convertEntityDto),
      popular: popular.map(this.realmService.convertEntityDto),
      spotlight: data.spotlight.map((s) => ({
        ...s,
        publicKey: new PublicKey(s.realmPublicKeyStr),
      })),
      trending: trending.map(this.realmService.convertEntityDto),
      version: data.version,
      web3: web3.map(this.realmService.convertEntityDto),
    };

    return discoverPage;
  }

  async updateDiscoverPage(data: Data, environment: Environment) {
    const newDiscoverPage = this.discoverPageRepository.create({
      data,
      environment,
    });

    await this.discoverPageRepository.save(newDiscoverPage);
    return this.getCurrentDiscoverPage(environment);
  }
}
