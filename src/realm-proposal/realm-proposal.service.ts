import { Injectable } from '@nestjs/common';
import { getGovernanceAccounts, Governance, pubkeyFilter } from '@solana/spl-governance';
import { Connection, PublicKey } from '@solana/web3.js';
import * as AR from 'fp-ts/Array';
import * as FN from 'fp-ts/function';
import * as TE from 'fp-ts/TaskEither';

import * as errors from '@lib/errors/gql';
import { HolaplexService } from '@src/holaplex/holaplex.service';
import { RealmSettingsService } from '@src/realm-settings/realm-settings.service';

import * as queries from './holaplexQueries';

@Injectable()
export class RealmProposalService {
  constructor(
    private readonly holaplexService: HolaplexService,
    private readonly realmSettingsService: RealmSettingsService,
  ) {}

  /**
   * Fetch a list of proposals in a Realm
   */
  getProposalsForRealm(realmPublicKey: PublicKey) {
    return FN.pipe(
      this.getGovernancesForRealm(realmPublicKey),
      TE.chainW((governances) =>
        this.holaplexService.requestV1(
          {
            query: queries.realmProposals.query,
            variables: {
              governances: governances.map((g) => g.toBase58()),
            },
          },
          queries.realmProposals.resp,
        ),
      ),
      TE.map(({ proposals }) => proposals),
      TE.map(
        AR.map(({ address }) => ({
          publicKey: new PublicKey(address),
        })),
      ),
    );
  }

  /**
   * Get a list of governances for a realm
   */
  private getGovernancesForRealm(realmPublicKey: PublicKey) {
    return FN.pipe(
      this.realmSettingsService.getCodeCommittedSettingsForRealm(realmPublicKey),
      TE.chainW(({ programId }) =>
        TE.tryCatch(
          () =>
            getGovernanceAccounts(
              new Connection('https://rpc.theindex.io'),
              new PublicKey(programId),
              Governance,
              [pubkeyFilter(1, realmPublicKey)],
            ),
          (e) => new errors.Exception(e),
        ),
      ),
      TE.map(AR.map((governance) => governance.pubkey)),
    );
  }
}
