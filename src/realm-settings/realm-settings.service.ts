import { Injectable } from '@nestjs/common';
import { PublicKey } from '@solana/web3.js';

import { Environment } from '@lib/types/Environment';
import { ConfigService } from '@src/config/config.service';
import { StaleCacheService } from '@src/stale-cache/stale-cache.service';

const DEFAULT_GOVERNANCE_PROGRAM = 'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw';

/**
 * Settings that were committed to code in the app.realms.today codebase
 */
export interface CodeCommittedSettings {
  bannerImage?: string;
  category?: string;
  displayName?: string;
  keywords?: string;
  ogImage?: string;
  programId: string;
  realmId?: string;
  sharedWalletId?: string;
  shortDescription?: string;
  sortRank?: number;
  symbol?: string;
  // external links
  discord?: string;
  github?: string;
  instagram?: string;
  linkedin?: string;
  twitter?: string;
  website?: string;
}

@Injectable()
export class RealmSettingsService {
  constructor(
    private readonly configService: ConfigService,
    private readonly staleCacheService: StaleCacheService,
  ) {}

  /**
   * Get's all the settings checked into the app.realms.today github repo
   */
  fetchAllCodeCommittedSettings = this.staleCacheService.dedupe(
    async (environment: Environment) => {
      return fetch(
        `${this.configService.get('app.codeCommitedInfoUrl')}/realms/${
          environment === 'mainnet' ? 'mainnet-beta' : 'devnet'
        }.json`,
      ).then<CodeCommittedSettings[]>((resp) => resp.json());
    },
    {
      dedupeKey: (environment) => environment,
      maxStaleAgeMs: 60 * 5,
    },
  );

  /**
   * Return a Realm's specific settings checked into the app.realms.today repo
   */
  async getCodeCommittedSettingsForRealm(realmPublicKey: PublicKey, environment: Environment) {
    const allSettings = await this.fetchAllCodeCommittedSettings(environment);
    const setting = allSettings.find((s) => s.realmId === realmPublicKey.toBase58());

    if (setting) {
      return setting;
    } else {
      return { programId: DEFAULT_GOVERNANCE_PROGRAM };
    }
  }
}
