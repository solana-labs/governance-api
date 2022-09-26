import { Injectable } from '@nestjs/common';
import { PublicKey } from '@solana/web3.js';
import * as AR from 'fp-ts/Array';
import * as EI from 'fp-ts/Either';
import * as FN from 'fp-ts/function';
import * as TE from 'fp-ts/TaskEither';

import * as errors from '@lib/errors/gql';
import { Environment } from '@lib/types/Environment';
import { HolaplexService } from '@src/holaplex/holaplex.service';
import {
  CodeCommittedSettings,
  RealmSettingsService,
} from '@src/realm-settings/realm-settings.service';

import * as queries from './holaplexQueries';

/**
 * Sometimes the URLs point to paths relative to app.realms.today. This will
 * normalize those
 */
function normalizeCodeCommittedUrl(url: string) {
  if (url.startsWith('/')) {
    return 'https://app.realms.today' + url;
  }

  return url;
}

@Injectable()
export class RealmService {
  constructor(
    private readonly holaplexService: HolaplexService,
    private readonly realmSettingsService: RealmSettingsService,
  ) {}

  /**
   * Fetch a Realm
   */
  getRealm(publicKey: PublicKey, environment: Environment) {
    if (environment === 'devnet') {
      return TE.left(new errors.UnsupportedDevnet());
    }

    return FN.pipe(
      this.holaplexService.requestV1(
        {
          query: queries.realm.query,
          variables: {
            address: publicKey.toBase58(),
          },
        },
        queries.realm.resp,
      ),
      TE.map(({ realms }) => realms),
      TE.map(AR.head),
      TE.chainW(TE.fromOption(() => new errors.NotFound())),
      TE.map(({ address, name }) => ({
        name,
        publicKey: new PublicKey(address),
      })),
      TE.bindTo('onchaindata'),
      TE.bindW('codecommitted', () =>
        FN.pipe(
          this.realmSettingsService.getCodeCommittedSettingsForRealm(publicKey, environment),
          TE.match(
            () => EI.right({} as Partial<CodeCommittedSettings>),
            (settings) => EI.right(settings as Partial<CodeCommittedSettings>),
          ),
        ),
      ),
      TE.map(
        ({ onchaindata, codecommitted }) =>
          ({
            bannerImageUrl: codecommitted.bannerImage
              ? normalizeCodeCommittedUrl(codecommitted.bannerImage)
              : undefined,
            iconUrl: codecommitted.ogImage
              ? normalizeCodeCommittedUrl(codecommitted.ogImage)
              : undefined,
            name: codecommitted.displayName || onchaindata.name,
            programPublicKey: codecommitted.programId
              ? new PublicKey(codecommitted.programId)
              : undefined,
            publicKey: onchaindata.publicKey,
            symbol: codecommitted.symbol,
            twitterHandle: codecommitted.twitter,
            websiteUrl: codecommitted.website,
          } as const),
      ),
    );
  }
}
