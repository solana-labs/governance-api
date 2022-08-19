import { CACHE_MANAGER, Injectable, Inject } from '@nestjs/common';
import { PublicKey } from '@solana/web3.js';
import { Cache } from 'cache-manager';
import * as AR from 'fp-ts/Array';
import * as FN from 'fp-ts/function';
import * as OP from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';

import * as errors from '@lib/errors/gql';
import { Environment } from '@lib/types/Environment';

interface CodeCommittedSettings {
  bannerImage: string;
  displayName: string;
  keywords?: undefined;
  ogImage: string;
  programId: string;
  realmId: string;
  sharedWalletId: string;
  sortRank: number;
  symbol: string;
  twitter?: undefined;
  website?: undefined;
}

@Injectable()
export class RealmSettingsService {
  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  /**
   * Get's all the settings checked into the app.realms.today github repo
   */
  fetchAllCodeCommittedSettings(environment: Environment) {
    const cacheKey = `realm-settings-all-${environment}`;

    return FN.pipe(
      TE.tryCatch(
        () => this.cacheManager.get<CodeCommittedSettings[]>(cacheKey),
        (e) => new errors.Exception(e),
      ),
      TE.map(OP.fromNullable),
      TE.chainW((settings) =>
        OP.isSome(settings)
          ? TE.right(settings.value)
          : FN.pipe(
              TE.tryCatch(
                () =>
                  fetch(
                    `https://app.realms.today/realms/${
                      environment === 'mainnet' ? 'mainnet-beta' : 'devnet'
                    }.json`,
                  ).then<CodeCommittedSettings[]>((response) => response.json()),
                (e) => new errors.Exception(e),
              ),
              TE.chain((settings) =>
                TE.tryCatch(
                  () => this.cacheManager.set(cacheKey, settings, { ttl: 60 }),
                  (e) => new errors.Exception(e),
                ),
              ),
            ),
      ),
    );
  }

  /**
   * Return a Realm's specific settings checked into the app.realms.today repo
   */
  getCodeCommittedSettingsForRealm(realmPublicKey: PublicKey, environment: Environment) {
    return FN.pipe(
      this.fetchAllCodeCommittedSettings(environment),
      TE.map(AR.findFirst((setting) => setting.realmId === realmPublicKey.toBase58())),
      TE.chainW(TE.fromOption(() => new errors.NotFound())),
    );
  }
}
