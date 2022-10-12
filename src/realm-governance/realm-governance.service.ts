import { Injectable } from '@nestjs/common';
import { PublicKey } from '@solana/web3.js';
import { BigNumber } from 'bignumber.js';
import { hoursToMilliseconds } from 'date-fns';
import * as AR from 'fp-ts/Array';
import * as EI from 'fp-ts/Either';
import * as FN from 'fp-ts/function';
import * as TE from 'fp-ts/TaskEither';

import * as errors from '@lib/errors/gql';
import { HolaplexService } from '@src/holaplex/holaplex.service';
import { Environment } from '@src/lib/types/Environment';
import { StaleCacheService } from '@src/stale-cache/stale-cache.service';

import * as queries from './holaplexQueries';

export interface Governance {
  address: PublicKey;
  communityMint: PublicKey | null;
  councilMint: PublicKey | null;
  communityMintMaxVoteWeight: BigNumber | null;
  communityMintMaxVoteWeightSource: string | null;
}

@Injectable()
export class RealmGovernanceService {
  constructor(
    private readonly holaplexService: HolaplexService,
    private readonly staleCacheService: StaleCacheService,
  ) {}

  /**
   * Get a list of governances for a realm
   */
  async getGovernancesForRealm(realmPublicKey: PublicKey, environment: Environment) {
    if (environment === 'devnet') {
      throw new errors.UnsupportedDevnet();
    }

    const governances = await this.holaplexGetGovernances(realmPublicKey);
    return governances.map((data) => {
      const governance: Governance = {
        address: new PublicKey(data.address),
        communityMint: data.realm?.communityMint ? new PublicKey(data.realm.communityMint) : null,
        councilMint: data.realm?.realmConfig?.councilMint
          ? new PublicKey(data.realm.realmConfig.councilMint)
          : null,
        communityMintMaxVoteWeight: data.realm?.realmConfig?.communityMintMaxVoteWeight
          ? new BigNumber(data.realm.realmConfig.communityMintMaxVoteWeight)
          : null,
        communityMintMaxVoteWeightSource:
          data.realm?.realmConfig?.communityMintMaxVoteWeightSource || null,
      };

      return governance;
    });
  }

  /**
   * Get governances from holaplex
   */
  private readonly holaplexGetGovernances = this.staleCacheService.dedupe(
    async (realm: PublicKey) => {
      const resp = await this.holaplexService.requestV1(
        {
          query: queries.realmGovernance.query,
          variables: {
            realms: [realm.toBase58()],
          },
        },
        queries.realmGovernance.resp,
      )();

      if (EI.isLeft(resp)) {
        throw resp.left;
      }

      return resp.right.governances;
    },
    {
      dedupeKey: (realm) => realm.toBase58(),
      maxStaleAgeMs: hoursToMilliseconds(6),
    },
  );
}
