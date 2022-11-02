import { CACHE_MANAGER, Injectable, Inject, Logger } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { differenceInMilliseconds } from 'date-fns';

interface CachedValue<V> {
  time: number;
  value: V;
}

interface Options<R, F extends (...args: any[]) => Promise<R>> {
  maxStaleAgeMs?: number;
  dedupeKey?: (...args: Parameters<F>) => string;
}

@Injectable()
export class StaleCacheService {
  private readonly inFlight: Map<string, Promise<any>> = new Map();
  private readonly logger = new Logger(StaleCacheService.name);

  constructor(@Inject(CACHE_MANAGER) private readonly cacheManager: Cache) {}

  dedupe<R, F extends (...args: any[]) => Promise<R>>(fn: F, options?: Options<R, F>): F {
    // @ts-ignore
    const newFn: F = async (...args: Parameters<F>) => {
      const cacheKeyBase =
        fn.toString() +
        (options?.dedupeKey
          ? options.dedupeKey(...args)
          : args.map((arg) => String(arg)).join('-'));

      const cacheKey = `stale-cache-${cacheKeyBase}`;
      const maxStaleAgeMs = options?.maxStaleAgeMs || 10;

      const cachedValue = await this.cacheManager.get<CachedValue<R>>(cacheKey);
      let inFlightResponse = this.inFlight.get(cacheKey) as Promise<R> | undefined;

      if (!inFlightResponse) {
        inFlightResponse = new Promise<R>((res, rej) => {
          fn(...args)
            .then((result: R) => {
              return this.cacheManager.set(
                cacheKey,
                {
                  value: result,
                  time: Date.now(),
                },
                0,
              );
            })
            .then((result) => {
              this.inFlight.delete(cacheKey);
              res(result.value);
            })
            .catch((e) => {
              if (e instanceof Error) {
                this.logger.error({
                  name: e.name,
                  message: e.message,
                  stack: e.stack,
                });
              } else {
                this.logger.error(e);
              }

              this.inFlight.delete(cacheKey);
              if (cachedValue) {
                res(cachedValue.value);
              } else {
                rej(e);
              }
            });
        });

        this.inFlight.set(cacheKey, inFlightResponse);
      }

      if (
        cachedValue &&
        Math.abs(differenceInMilliseconds(Date.now(), cachedValue.time)) < maxStaleAgeMs
      ) {
        return cachedValue.value;
      }

      return inFlightResponse;
    };

    return newFn;
  }
}
