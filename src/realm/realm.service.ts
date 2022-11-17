import { Injectable } from '@nestjs/common';
import { PublicKey } from '@solana/web3.js';
import { hoursToMilliseconds } from 'date-fns';
import * as EI from 'fp-ts/Either';

import * as errors from '@lib/errors/gql';
import { Environment } from '@lib/types/Environment';
import { ConfigService } from '@src/config/config.service';
import { HolaplexService } from '@src/holaplex/holaplex.service';
import { exists } from '@src/lib/typeGuards/exists';
import { RealmSettingsService } from '@src/realm-settings/realm-settings.service';
import { StaleCacheService } from '@src/stale-cache/stale-cache.service';

import { RealmCategory } from './dto/RealmCategory';
import * as queries from './holaplexQueries';

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
    private readonly realmSettingsService: RealmSettingsService,
    private readonly staleCacheService: StaleCacheService,
  ) {}

  /**
   * Fetch a Realm
   */
  async getRealm(publicKey: PublicKey, environment: Environment) {
    if (environment === 'devnet') {
      throw new errors.UnsupportedDevnet();
    }

    const { address, name } = await this.getHolaplexRealm(publicKey);
    const settings = await this.realmSettingsService.getCodeCommittedSettingsForRealm(
      publicKey,
      environment,
    );

    return {
      bannerImageUrl: settings.bannerImage
        ? normalizeCodeCommittedUrl(
            settings.bannerImage,
            this.configService.get('app.codeCommitedInfoUrl'),
          )
        : undefined,
      category: normalizeCategory(settings.category),
      iconUrl: settings.ogImage
        ? normalizeCodeCommittedUrl(
            settings.ogImage,
            this.configService.get('app.codeCommitedInfoUrl'),
          )
        : undefined,
      name: settings.displayName || name,
      programPublicKey: settings.programId ? new PublicKey(settings.programId) : undefined,
      publicKey: publicKey,
      shortDescription: settings.shortDescription,
      symbol: settings.symbol,
      urlId: encodeURIComponent(settings.symbol || address),
      // external links
      discordUrl: settings.discord,
      githubUrl: settings.github,
      instagramUrl: settings.instagram,
      linkedInUrl: settings.linkedin,
      twitterHandle: settings.twitter,
      websiteUrl: settings.website,
    } as const;
  }

  /**
   * Get a list of realms for a dropdown
   */
  async getRealmDropdownList(environment: Environment) {
    if (environment === 'devnet') {
      throw new errors.UnsupportedDevnet();
    }

    const allSettings = await this.realmSettingsService.fetchAllCodeCommittedSettings(environment);
    const pks = allSettings
      .map((setting) => setting.realmId)
      .filter(exists)
      .map((pk) => new PublicKey(pk));

    const details = (await this.getHolaplexRealms(pks)).realms;
    const detailsMap = details.reduce((acc, detail) => {
      acc[detail.address] = detail;
      return acc;
    }, {} as { [pk: string]: { address: string; name: string } });

    return allSettings
      .map((setting) => {
        if (!setting.realmId) {
          return null;
        }

        const details = detailsMap[setting.realmId];

        if (!details) {
          return null;
        }

        return {
          iconUrl: setting.ogImage,
          name: setting.displayName || details.name,
          publicKey: new PublicKey(details.address),
          urlId: encodeURIComponent(setting.symbol || details.address),
        };
      })
      .filter(exists)
      .sort((a, b) => a.name.toLocaleLowerCase().localeCompare(b.name.toLocaleLowerCase()));
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
    async (publicKey: PublicKey) => {
      const resp = await this.holaplexService.requestV1(
        {
          query: queries.realm.query,
          variables: {
            address: publicKey.toBase58(),
          },
        },
        queries.realm.resp,
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
