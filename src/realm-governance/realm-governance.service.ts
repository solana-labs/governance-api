import { Injectable } from '@nestjs/common';
import { PublicKey } from '@solana/web3.js';
import { BigNumber } from 'bignumber.js';
import * as AR from 'fp-ts/Array';
import * as FN from 'fp-ts/function';
import * as TE from 'fp-ts/TaskEither';

import * as errors from '@lib/errors/gql';
import { HolaplexService } from '@src/holaplex/holaplex.service';
import { Environment } from '@src/lib/types/Environment';

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
  constructor(private readonly holaplexService: HolaplexService) {}

  /**
   * Get a list of governances for a realm
   */
  getGovernancesForRealm(realmPublicKey: PublicKey, environment: Environment) {
    if (environment === 'devnet') {
      return TE.left(new errors.UnsupportedDevnet());
    }

    return FN.pipe(
      this.holaplexService.requestV1(
        {
          query: queries.realmGovernance.query,
          variables: {
            realms: [realmPublicKey.toBase58()],
          },
        },
        queries.realmGovernance.resp,
      ),
      TE.map(({ governances }) => governances),
      TE.map(
        AR.map((data) => {
          const governance: Governance = {
            address: new PublicKey(data.address),
            communityMint: data.realm?.communityMint
              ? new PublicKey(data.realm.communityMint)
              : null,
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
        }),
      ),
    );
  }
}
