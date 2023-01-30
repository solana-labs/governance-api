import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PublicKey } from '@solana/web3.js';
import BigNumber from 'bignumber.js';
import { hoursToMilliseconds } from 'date-fns';
import * as EI from 'fp-ts/Either';
import { In, Repository } from 'typeorm';

import { User } from '@lib/decorators/CurrentUser';
import * as errors from '@lib/errors/gql';
import { Environment } from '@lib/types/Environment';
import { ConfigService } from '@src/config/config.service';
import { HolaplexService } from '@src/holaplex/holaplex.service';
import { exists } from '@src/lib/typeGuards/exists';
import { OnChainService } from '@src/on-chain/on-chain.service';
import { RealmHubService } from '@src/realm-hub/realm-hub.service';
import { RealmSettingsService } from '@src/realm-settings/realm-settings.service';
import { StaleCacheService } from '@src/stale-cache/stale-cache.service';
import { User as UserEntity } from '@src/user/entities/User.entity';

import { Realm as RealmDto } from './dto/Realm';
import { RealmCategory } from './dto/RealmCategory';
import { RealmRoadmap } from './dto/RealmRoadmap';
import { Realm } from './entities/Realm.entity';
import * as queries from './holaplexQueries';
import { RealmInput as RealmInputDto } from './inputDto/RealmInput';

/**
 * Sometimes the URLs point to paths relative to app.realms.today. This will
 * normalize those
 */
function normalizeCodeCommittedUrl(url: string, baseUrl: string) {
  if (url.startsWith('/')) {
    return baseUrl + url;
  }

  return url;
}

/**
 * Convert a plain string into a Category
 */
function normalizeCategory(plain?: string): RealmCategory {
  switch (plain?.toLowerCase()) {
    case 'daotools':
      return RealmCategory.DAOTools;
    case 'defi':
      return RealmCategory.Defi;
    case 'gaming':
      return RealmCategory.Gaming;
    case 'nft':
      return RealmCategory.Nft;
    case 'web3':
      return RealmCategory.Web3;
    default:
      return RealmCategory.Other;
  }
}

@Injectable()
export class RealmService {
  constructor(
    private readonly configService: ConfigService,
    private readonly holaplexService: HolaplexService,
    private readonly onChainService: OnChainService,
    private readonly realmHubService: RealmHubService,
    private readonly realmSettingsService: RealmSettingsService,
    private readonly staleCacheService: StaleCacheService,
    @InjectRepository(Realm)
    private readonly realmRepository: Repository<Realm>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
  ) {}

  /**
   * Convert an entity to an api response object
   */
  convertEntityDto(realm: Realm): RealmDto {
    return {
      about: realm.data.about,
      bannerImageUrl: realm.data.bannerImageUrl,
      category: realm.data.category,
      discordUrl: realm.data.discordUrl,
      displayName: realm.data.displayName,
      documentation: realm.data.documentation,
      faq: realm.data.faq,
      gallery: realm.data.gallery,
      githubUrl: realm.data.githubUrl,
      heading: realm.data.heading,
      iconUrl: realm.data.iconUrl,
      instagramUrl: realm.data.instagramUrl,
      linkedInUrl: realm.data.linkedInUrl,
      name: realm.data.name,
      programPublicKey: realm.data.programPublicKeyStr
        ? new PublicKey(realm.data.programPublicKeyStr)
        : undefined,
      publicKey: new PublicKey(realm.publicKeyStr),
      roadmap: {
        ...realm.data.roadmap,
        items: realm.data.roadmap.items.map((item) => ({
          ...item,
          date: item.date ? new Date(item.date).getTime() : undefined,
        })),
      },
      resources: realm.data.resources,
      shortDescription: realm.data.shortDescription,
      symbol: realm.symbol,
      team: realm.data.team,
      token: realm.data.token
        ? {
            mint: new PublicKey(realm.data.token.mintPublicKeyStr),
          }
        : undefined,
      twitterHandle: realm.data.twitterHandle,
      urlId: encodeURIComponent(realm.symbol || realm.publicKeyStr),
      websiteUrl: realm.data.websiteUrl,
    };
  }

  /**
   * Follow a realm
   */
  async followRealm(realmPublicKey: PublicKey, user: User, environment: Environment) {
    if (environment === 'devnet') {
      throw new errors.UnsupportedDevnet();
    }

    const userEntity = await this.userRepository.findOne({ where: { id: user.id } });

    if (!userEntity) {
      throw new errors.NotFound();
    }

    const realms = userEntity.data.realmsFollowed || [];

    if (!realms.includes(realmPublicKey.toBase58())) {
      realms.push(realmPublicKey.toBase58());
    }

    userEntity.data.realmsFollowed = realms;
    await this.userRepository.save(userEntity);
    return { publicKey: user.publicKey };
  }

  /**
   * Get a db entity for a realm
   */
  async getRealmEntity(publicKey: PublicKey, environment: Environment) {
    let realm = await this.realmRepository.findOne({
      where: { publicKeyStr: publicKey.toBase58() },
    });

    if (!realm) {
      realm = await this.setupRealm(publicKey, environment);
    }

    return realm;
  }

  /**
   * Fetch a Realm
   */
  async getRealm(publicKey: PublicKey, environment: Environment) {
    const realm = await this.getRealmEntity(publicKey, environment);
    return this.convertEntityDto(realm);
  }

  /**
   * Fetch a realm by its url id
   */
  async getRealmByUrlId(id: string, environment: Environment) {
    // assumed the url id is a symbol and try to fetch by that first
    const symbol = decodeURIComponent(id).toLocaleLowerCase();

    let realm = await this.realmRepository.findOne({
      where: { symbol },
    });

    // assume it's a public key next and try that
    if (!realm) {
      realm = await this.realmRepository.findOne({
        where: { publicKeyStr: id },
      });
    }

    // if it's a valid dao, let's create the realm
    if (!realm) {
      try {
        const publicKey = new PublicKey(id);
        realm = await this.setupRealm(publicKey, environment);
      } catch {
        realm = null;
      }
    }

    // if it's still not found, it's not a real realm
    if (!realm) {
      throw new errors.NotFound();
    }

    return this.convertEntityDto(realm);
  }

  /**
   * Get multiple realms at once
   */
  async getRealms(publicKeys: PublicKey[], environment: Environment) {
    if (environment === 'devnet') {
      throw new errors.UnsupportedDevnet();
    }

    const pkStrs = publicKeys.map((pk) => pk.toBase58());

    const dbRealms = await this.realmRepository.find({
      where: { publicKeyStr: In(pkStrs) },
    });

    const existingRealmsPks = new Set(dbRealms.map((realm) => realm.publicKeyStr));
    const missingRealms = publicKeys.filter((pk) => {
      return !existingRealmsPks.has(pk.toBase58());
    });

    const extraRealms = (
      await Promise.all(
        missingRealms.map((pk) => this.setupRealm(pk, environment).catch(() => null)),
      )
    ).filter(exists);
    return dbRealms.concat(extraRealms);
  }

  /**
   * Get a list of public keys of all the realms
   */
  async getAllRealmPublicKeys(environment: Environment) {
    if (environment === 'devnet') {
      throw new errors.UnsupportedDevnet();
    }

    const realms = await this.realmRepository
      .createQueryBuilder('realm')
      .select('realm.publicKeyStr')
      .getMany();

    const pks = new Set(realms.map((realm) => realm.publicKeyStr));
    const allSettings = await this.realmSettingsService.fetchAllCodeCommittedSettings(environment);
    const settingsPks = allSettings.map((setting) => setting.realmId).filter(exists);

    for (const pk of settingsPks) {
      pks.add(pk);
    }

    return Array.from(pks).map((pkStr) => new PublicKey(pkStr));
  }

  /**
   * Get a list of realms for a dropdown
   */
  async getRealmDropdownList(environment: Environment) {
    if (environment === 'devnet') {
      throw new errors.UnsupportedDevnet();
    }

    const pks = await this.getAllRealmPublicKeys(environment);
    const realms = await this.getRealms(pks, environment);

    return realms
      .map((realm) => this.convertEntityDto(realm))
      .sort((a, b) => a.name.toLocaleLowerCase().localeCompare(b.name.toLocaleLowerCase()));
  }

  /**
   * Get a list of realms that a user follows
   */
  async listFollowedRealms(user: User, environment: Environment) {
    const userEntity = await this.userRepository.findOne({ where: { id: user.id } });

    if (!userEntity) {
      throw new errors.Unauthorized();
    }

    const realmPks = userEntity.data.realmsFollowed || [];
    const realms = await this.realmRepository.find({
      where: { environment, publicKeyStr: In(realmPks) },
    });
    return realms.map(this.convertEntityDto);
  }

  /**
   * Set up a realm that exists but has not been added to the db yet
   */
  async setupRealm(publicKey: PublicKey, environment: Environment) {
    let name: string | undefined = undefined;

    try {
      name = (await this.getHolaplexRealm(publicKey, environment)).name;
    } catch (e) {
      const realm = await this.onChainService.getRealmAccount(publicKey, environment);
      name = realm.account.name;
    }

    const settings = await this.realmSettingsService.getCodeCommittedSettingsForRealm(
      publicKey,
      environment,
    );

    const hubInfo = await this.realmHubService.getCodeCommittedHubInfoForRealm(
      publicKey,
      environment,
    );

    const realm = this.realmRepository.create({
      data: {
        about: hubInfo.about,
        bannerImageUrl: settings.bannerImage,
        category: normalizeCategory(settings.category),
        discordUrl: settings.discord,
        displayName: settings.displayName || name,
        documentation: hubInfo.documentation,
        faq: hubInfo.faq,
        gallery: hubInfo.gallery,
        githubUrl: settings.github,
        heading: hubInfo.heading,
        iconUrl: settings.ogImage
          ? normalizeCodeCommittedUrl(
              settings.ogImage,
              this.configService.get('app.codeCommitedInfoUrl'),
            )
          : undefined,
        instagramUrl: settings.instagram,
        linkedInUrl: settings.linkedin,
        name: name,
        programPublicKeyStr: settings.programId,
        roadmap: hubInfo.roadmap as RealmRoadmap,
        resources: hubInfo.resources,
        shortDescription: settings.shortDescription,
        team: hubInfo.team,
        token: hubInfo.token
          ? {
              mintPublicKeyStr: hubInfo.token.mint.toBase58(),
            }
          : undefined,
        twitterHandle: settings.twitter,
        websiteUrl: settings.website,
      },
      environment: environment,
      publicKeyStr: publicKey.toBase58(),
      symbol: settings.symbol?.toLocaleLowerCase(),
    });

    await this.realmRepository.save(realm);

    return realm;
  }

  /**
   * Determines, for a realm, if a new symbol is valid
   */
  async newSymbolIsValid(realmPublicKey: PublicKey, newSymbol: string) {
    const realm = await this.realmRepository.findOne({
      where: { publicKeyStr: realmPublicKey.toBase58() },
    });

    if (!realm) {
      throw new errors.NotFound();
    }

    if (realm.symbol === newSymbol.toLocaleLowerCase()) {
      return true;
    }

    const existing = await this.realmRepository.findOne({
      where: { symbol: newSymbol.toLocaleLowerCase() },
    });

    if (existing && existing.publicKeyStr !== realmPublicKey.toBase58()) {
      return false;
    }

    return true;
  }

  /**
   * Unfollow a realm
   */
  async unfollowRealm(realmPublicKey: PublicKey, user: User, environment: Environment) {
    if (environment === 'devnet') {
      throw new errors.UnsupportedDevnet();
    }

    const userEntity = await this.userRepository.findOne({ where: { id: user.id } });

    if (!userEntity) {
      throw new errors.NotFound();
    }

    const realms = (userEntity.data.realmsFollowed || []).filter(
      (r) => r !== realmPublicKey.toBase58(),
    );
    userEntity.data.realmsFollowed = realms;
    await this.userRepository.save(userEntity);
    return { publicKey: user.publicKey };
  }

  /**
   * Update the details on a Realm
   */
  async updateRealm(
    user: User,
    publicKey: PublicKey,
    environment: Environment,
    updates: RealmInputDto,
  ) {
    if (environment === 'devnet') {
      throw new errors.UnsupportedDevnet();
    }

    if (!(await this.userIsCouncilMember(publicKey, user.publicKey, environment))) {
      throw new errors.Unauthorized();
    }

    const realm = await this.getRealmEntity(publicKey, environment);

    realm.data.about = [...updates.about];
    realm.data.bannerImageUrl = updates.bannerImageUrl;
    realm.data.category = updates.category;
    realm.data.discordUrl = updates.discordUrl;
    realm.data.displayName = updates.displayName;
    realm.data.documentation = updates.documentation ? { ...updates.documentation } : undefined;
    realm.data.faq = [...updates.faq];
    realm.data.gallery = [...updates.gallery];
    realm.data.githubUrl = updates.githubUrl;
    realm.data.heading = updates.heading ? { ...updates.heading } : undefined;
    realm.data.iconUrl = updates.iconUrl;
    realm.data.instagramUrl = updates.instagramUrl;
    realm.data.linkedInUrl = updates.linkedInUrl;
    realm.data.resources = [...updates.resources];
    realm.data.roadmap = { ...updates.roadmap };
    realm.data.shortDescription = updates.shortDescription;
    realm.data.team = [...updates.team];
    realm.data.token = updates.token
      ? {
          mintPublicKeyStr: updates.token.mint.toBase58(),
        }
      : undefined;
    realm.data.twitterHandle = updates.twitterHandle;
    realm.data.websiteUrl = updates.websiteUrl;
    realm.symbol = updates.symbol?.toLocaleLowerCase();

    try {
      await this.realmRepository.save(realm);
      return this.convertEntityDto(realm);
    } catch (e: any) {
      if ('code' in e && e.code === '23505') {
        throw new errors.NotUnique('symbol');
      } else {
        throw e;
      }
    }
  }

  /**
   * Check if a user is a council member
   */
  async userIsCouncilMember(
    realmPublicKey: PublicKey,
    userPublicKey: PublicKey,
    environment: Environment,
  ) {
    if (environment === 'devnet') {
      throw new errors.UnsupportedDevnet();
    }

    const realmResp = await this.holaplexService.requestV1(
      {
        query: queries.realmCouncil.query,
        variables: {
          address: realmPublicKey.toBase58(),
        },
      },
      queries.realmCouncil.resp,
    )();

    if (EI.isLeft(realmResp)) {
      return false;
    }

    const councilMintPublicKeyStr = realmResp.right.realms[0].realmConfig?.councilMint;

    if (!councilMintPublicKeyStr) {
      return false;
    }

    const tokenAccount = await this.onChainService.getTokenAccountForUser(
      userPublicKey,
      new PublicKey(councilMintPublicKeyStr),
      environment,
    );

    if (tokenAccount && tokenAccount.uiAmount > 0) {
      return true;
    }

    // see if they have some tokens deposited
    const holaplexResp = await this.holaplexService.requestV1(
      {
        query: queries.councilMintAmount.query,
        variables: { mint: councilMintPublicKeyStr, realm: realmPublicKey.toBase58() },
      },
      queries.councilMintAmount.resp,
    )();

    if (EI.isRight(holaplexResp)) {
      const amountStr =
        holaplexResp.right.tokenOwnerRecords.find(
          ({ governingTokenOwner }) => userPublicKey.toBase58() === governingTokenOwner,
        )?.governingTokenDepositAmount || '0';

      const amount = new BigNumber(amountStr);

      if (amount.isGreaterThan(0)) {
        return true;
      }
    }

    return false;
  }

  private readonly getHolaplexRealms = this.staleCacheService.dedupe(
    async (publicKeys: PublicKey[]) => {
      const resp = await this.holaplexService.requestV1(
        {
          query: queries.realms.query,
          variables: {
            addresses: publicKeys.map((pk) => pk.toBase58()),
          },
        },
        queries.realm.resp,
      )();

      if (EI.isLeft(resp)) {
        throw resp.left;
      }

      return resp.right;
    },
    {
      dedupeKey: (pks) => pks.map((pk) => pk.toBase58()).join('-'),
      maxStaleAgeMs: hoursToMilliseconds(12),
    },
  );

  private readonly getHolaplexRealm = this.staleCacheService.dedupe(
    async (publicKey: PublicKey, environment: Environment) => {
      const resp = await this.holaplexService.requestV1(
        {
          query: queries.realm.query,
          variables: {
            address: publicKey.toBase58(),
          },
        },
        queries.realm.resp,
        environment,
      )();

      if (EI.isLeft(resp)) {
        throw resp.left;
      }

      const realm = resp.right.realms[0];

      if (!realm) {
        throw new errors.NotFound();
      }

      return realm;
    },
    {
      dedupeKey: (pk) => pk.toBase58(),
      maxStaleAgeMs: hoursToMilliseconds(12),
    },
  );
}
