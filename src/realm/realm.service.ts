import { Injectable } from '@nestjs/common';
import { PublicKey } from '@solana/web3.js';
import * as AR from 'fp-ts/Array';
import * as FN from 'fp-ts/function';
import * as TE from 'fp-ts/TaskEither';

import * as errors from '@lib/errors/gql';
import { HolaplexService } from '@src/holaplex/holaplex.service';

import * as queries from './holaplexQueries';

@Injectable()
export class RealmService {
  constructor(private readonly holaplexService: HolaplexService) {}

  /**
   * Fetch a Realm
   */
  getRealm(publicKey: PublicKey) {
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
    );
  }
}
