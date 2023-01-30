import { Injectable } from '@nestjs/common';
import * as FN from 'fp-ts/function';
import * as TE from 'fp-ts/TaskEither';
import { request, RequestDocument } from 'graphql-request';
import * as IT from 'io-ts';

import * as errors from '@lib/errors/gql';
import { Environment } from '@lib/types/Environment';

@Injectable()
export class HolaplexService {
  /**
   * Make a GQL request to Holaplex's v1 indexer API
   */
  requestV1<Variables = any, A = any, O = any, I = any>(
    req: {
      query: RequestDocument;
      variables?: Variables;
    },
    res: IT.Type<A, O, I>,
    environment?: Environment,
  ) {
    return FN.pipe(
      TE.tryCatch(
        () =>
          request(
            environment === 'devnet'
              ? 'https://graph.devnet.holaplex.tools/v1/graphql'
              : 'https://graph.holaplex.com/v1',
            req.query,
            req.variables,
          ),
        (e) => new errors.Exception(e),
      ),
      TE.chainW((result) => TE.fromEither(res.decode(result))),
    );
  }
}
