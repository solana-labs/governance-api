import { Injectable } from '@nestjs/common';
import { PublicKey } from '@solana/web3.js';
import * as AR from 'fp-ts/Array';
import * as FN from 'fp-ts/function';
import * as TE from 'fp-ts/TaskEither';

import { Environment } from '@lib/decorators/CurrentEnvironment';
import * as errors from '@lib/errors/gql';
import { HolaplexService } from '@src/holaplex/holaplex.service';

import * as queries from './holaplexQueries';

@Injectable()
export class RealmMemberService {
  constructor(private readonly holaplexService: HolaplexService) {}

  /**
   * Fetch a list of members in a Realm
   */
  getMembersForRealm(realmPublicKey: PublicKey, environment: Environment) {
    if (environment === 'devnet') {
      return TE.left(new errors.UnsupportedDevnet());
    }

    return FN.pipe(
      this.holaplexService.requestV1(
        {
          query: queries.realmMembers.query,
          variables: {
            realm: realmPublicKey.toBase58(),
          },
        },
        queries.realmMembers.resp,
      ),
      TE.map(({ tokenOwnerRecords }) => tokenOwnerRecords),
      TE.map(
        AR.map(({ address }) => ({
          publicKey: new PublicKey(address),
        })),
      ),
    );
  }

  /**
   * Get a count of the total members in the realm
   */
  getMembersCountForRealm(realmPublicKey: PublicKey, environment: Environment) {
    if (environment === 'devnet') {
      return TE.left(new errors.UnsupportedDevnet());
    }

    return FN.pipe(
      this.holaplexService.requestV1(
        {
          query: queries.realmMembers.query,
          variables: {
            realm: realmPublicKey.toBase58(),
          },
        },
        queries.realmMembers.resp,
      ),
      TE.map(({ tokenOwnerRecords }) => tokenOwnerRecords.length),
    );
  }
}
