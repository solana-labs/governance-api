import { Injectable } from '@nestjs/common';
import * as FN from 'fp-ts/function';
import * as TE from 'fp-ts/TaskEither';
import { request as _request, RequestDocument } from 'graphql-request';
import * as IT from 'io-ts';

import * as errors from '@lib/errors/gql';
import { dedupe } from '@src/lib/cacheAndDedupe';

const request = dedupe(_request, {
  key: (...args) => JSON.stringify(args),
  ttl: 60 * 1000,
});

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
  ) {
    return FN.pipe(
      TE.tryCatch(
        () => request('https://graph.holaplex.com/v1', req.query, req.variables),
        (e) => new errors.Exception(e),
      ),
      TE.chainW((result) => TE.fromEither(res.decode(result))),
    );
  }
}
