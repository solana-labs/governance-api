import { CACHE_MANAGER, Injectable, Inject } from '@nestjs/common';
import { PublicKey } from '@solana/web3.js';
import { Cache } from 'cache-manager';
import * as AR from 'fp-ts/Array';
import * as FN from 'fp-ts/function';
import * as OP from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';

import * as errors from '@lib/errors/gql';
import { Environment } from '@lib/types/Environment';
import { ConfigService } from '@src/config/config.service';

const DEFAULT_GOVERNANCE_PROGRAM = 'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw';

/**
 * Settings that were committed to code in the app.realms.today codebase
 */
export interface CodeCommittedSettings {
  bannerImage?: string;
  displayName?: string;
  keywords?: string;
  ogImage?: string;
  programId: string;
  realmId?: string;
  sharedWalletId?: string;
  shortDescription?: string;
  sortRank?: number;
  symbol?: string;
  twitter?: string;
  website?: string;
}

@Injectable()
export class RealmSettingsService {
  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly configService: ConfigService,
  ) {}

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
                    `${this.configService.get('app.codeCommitedInfoUrl')}/realms/${
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
      TE.map((setting) =>
        OP.isNone(setting)
          ? ({
              programId: DEFAULT_GOVERNANCE_PROGRAM,
            } as CodeCommittedSettings)
          : setting.value,
      ),
    );
  }
}
