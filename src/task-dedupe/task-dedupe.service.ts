import { CACHE_MANAGER, Injectable, Inject } from '@nestjs/common';
import { Cache } from 'cache-manager';
import * as EI from 'fp-ts/Either';
import * as FN from 'fp-ts/function';
import * as TE from 'fp-ts/TaskEither';

import * as errors from '@lib/errors/gql';

@Injectable()
export class TaskDedupeService {
  private taskMap = new Map<string, Promise<EI.Either<any, any>>>();

  constructor(@Inject(CACHE_MANAGER) private readonly cacheManager: Cache) {}

  dedupe<E, T>(args: {
    /**
     * A unique key for the task to be performed. The task is deduped using
     * this key.
     */
    key: string;
    /**
     * The function to dedupe.
     */
    fn: TE.TaskEither<E, T>;
    /**
     * Cache ttl, measured in seconds. If a ttl is provided, the result of the
     * task is also cached using the ttl. If no ttl is provided, the task in
     * only deduped, not cached.
     */
    ttl?: number;
  }): TE.TaskEither<E | errors.Exception, T> {
    const processed = this.taskMap.get(args.key);

    if (processed) {
      return FN.pipe(() => processed);
    }

    return FN.pipe(
      TE.tryCatch(
        () => this.cacheManager.get<T | undefined>(args.key),
        (e) => new errors.Exception(e),
      ),
      TE.chainW((result) => {
        if (result) {
          return TE.right(result);
        } else {
          let resolver: (result: EI.Either<E, T>) => void;
          const promise = new Promise<EI.Either<E, T>>((resolve) => {
            resolver = resolve;
          });

          this.taskMap.set(args.key, promise);

          return FN.pipe(
            args.fn,
            TE.matchW(
              (e) => {
                resolver(EI.left(e));
                this.taskMap.delete(args.key);
                return EI.left(e);
              },
              (r) => {
                resolver(EI.right(r));
                this.taskMap.delete(args.key);
                return EI.right(r);
              },
            ),
            TE.of,
            TE.flattenW,
            TE.chainW((result) => {
              if (args.ttl) {
                const ttl = args.ttl;

                return TE.tryCatch(
                  () => this.cacheManager.set(args.key, result, { ttl }),
                  (e) => new errors.Exception(e),
                );
              }

              return TE.right(result);
            }),
          );
        }
      }),
    );
  }
}
