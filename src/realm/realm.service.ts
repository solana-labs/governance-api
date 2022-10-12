import { Injectable } from '@nestjs/common';
import { PublicKey } from '@solana/web3.js';
import { hoursToMilliseconds } from 'date-fns';
import * as EI from 'fp-ts/Either';

import * as errors from '@lib/errors/gql';
import { Environment } from '@lib/types/Environment';
import { ConfigService } from '@src/config/config.service';
import { HolaplexService } from '@src/holaplex/holaplex.service';
import { RealmSettingsService } from '@src/realm-settings/realm-settings.service';
import { StaleCacheService } from '@src/stale-cache/stale-cache.service';

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

    const { name } = await this.getHolaplexRealm(publicKey);
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
      // external links
      discordUrl: settings.discord,
      githubUrl: settings.github,
      instagramUrl: settings.instagram,
      linkedInUrl: settings.linkedin,
      twitterHandle: settings.twitter,
      websiteUrl: settings.website,
    } as const;
  }

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
