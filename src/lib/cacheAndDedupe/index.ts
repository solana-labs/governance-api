import { differenceInMilliseconds } from 'date-fns';

interface CachedValue<V> {
  time: number;
  value: V;
}

interface Options<R, F extends ((...args: any[]) => Promise<R>)> {
  ttl?: number;
  key?: (...args: Parameters<F>) => string;
}

const cache: Map<string, CachedValue<any>> = new Map();
const inFlight: Map<string, Promise<any>> = new Map();
let id = 0;

export const dedupe = <R, F extends ((...args: any[]) => Promise<R>)>(fn: F, options?: Options<R, F>): F => {
  const key = (id++).toString();

  return ((...args: Parameters<F>) => {
    const cacheKey = options?.key
      ? key + options.key(...args)
      : key;

    const cachedValue = cache.get(cacheKey) as CachedValue<R> | undefined;
    let inFlightValue = inFlight.get(cacheKey) as Promise<R> | undefined;

    if (!inFlightValue) {
      inFlightValue = new Promise<R>(res => {
        fn(...args).then((result: R) => {
          cache.set(cacheKey, {
            value: result,
            time: Date.now(),
          });
          inFlight.delete(cacheKey);
          res(result);
        })
      })
      inFlight.set(cacheKey, inFlightValue);
    }

    const ttl = options?.ttl || 10000;

    if (cachedValue && Math.abs(differenceInMilliseconds(Date.now(), cachedValue.time)) < ttl) {
      return Promise.resolve(cachedValue.value);
    }

    return inFlightValue;
  }) as F;
}
