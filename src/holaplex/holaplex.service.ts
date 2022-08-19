import { Injectable } from '@nestjs/common';
import * as FN from 'fp-ts/function';
import * as TE from 'fp-ts/TaskEither';
import { request, RequestDocument } from 'graphql-request';
import * as IT from 'io-ts';

import * as errors from '@lib/errors/gql';

@Injectable()
export class HolaplexService {
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
