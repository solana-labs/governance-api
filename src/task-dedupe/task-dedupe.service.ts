import { CACHE_MANAGER, Injectable, Inject, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cache } from 'cache-manager';
import { differenceInMilliseconds } from 'date-fns';
import * as EI from 'fp-ts/Either';
import * as FN from 'fp-ts/function';
import * as TE from 'fp-ts/TaskEither';
import { Repository } from 'typeorm';

import * as errors from '@lib/errors/gql';
import { exists } from '@src/lib/typeGuards/exists';
import { waitTE } from '@src/lib/wait';

import { TaskDedupe } from './entities/TaskDedupe.entity';

@Injectable()
export class TaskDedupeService {
  private taskMap = new Map<string, Promise<EI.Either<any, any>>>();
  private logger = new Logger(TaskDedupeService.name);

  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    @InjectRepository(TaskDedupe)
    private readonly taskDedupeRepository: Repository<TaskDedupe>,
  ) {}

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
     * The valid cache time for the results, in ms. Defaults to 1000 ms.
     */
    ttl?: number;
  }): TE.TaskEither<E | errors.Exception, T> {
    const ttl = args.ttl || 1000;
    const processed = this.taskMap.get(args.key);

    if (processed) {
      this.logger.log(`In memory dedupe of ${args.key}`);
      return FN.pipe(() => processed);
    }

    return FN.pipe(
      TE.tryCatch(
        () => this.cacheManager.get<T | undefined>(args.key),
        (e) => new errors.Exception(e),
      ),
      TE.chainW((result) => {
        if (result) {
          this.logger.log(`In memory cache of ${args.key}`);
          return TE.right(result);
        } else {
          let resolver: (result: EI.Either<E | errors.Exception, T>) => void;
          const promise = new Promise<EI.Either<E | errors.Exception, T>>((resolve) => {
            resolver = resolve;
          });

          this.taskMap.set(args.key, promise);

          return FN.pipe(
            TE.tryCatch(
              () => this.taskDedupeRepository.findOne({ where: { key: args.key } }),
              (e) => new errors.Exception(e),
            ),
            TE.chainW((existingTask) => {
              // Task exists, the results are complete, and is within the ttl
              if (
                existingTask &&
                exists(existingTask.result) &&
                differenceInMilliseconds(Date.now(), existingTask.updated) < ttl
              ) {
                this.logger.log(`Database cache of ${args.key}`);
                return TE.right(existingTask.result as T);
              }
              // Task exists, results are complete, but expired
              else if (existingTask && exists(existingTask.result)) {
                this.logger.log(`Database cache expired, re-executing ${args.key}`);
                existingTask.result = null;

                return FN.pipe(
                  TE.tryCatch(
                    () => this.taskDedupeRepository.save(existingTask),
                    (e) => new errors.Exception(e),
                  ),
                  TE.chainW(() => args.fn),
                  TE.chainW((result) => {
                    existingTask.result = result;

                    return TE.tryCatch(
                      () => this.taskDedupeRepository.save(existingTask),
                      (e) => new errors.Exception(e),
                    );
                  }),
                  TE.map((task) => task.result as T),
                );
              }
              // Task exists, but results aren't available
              else if (
                existingTask &&
                differenceInMilliseconds(Date.now(), existingTask.updated) < ttl
              ) {
                this.logger.log(`Waiting on results for ${args.key}`);
                return FN.pipe(
                  waitTE(1000),
                  TE.chainW(() => this.dedupe(args)),
                );
              }
              // Else, first time
              else {
                this.logger.log(`No database cache, executing ${args.key}`);
                const task = this.taskDedupeRepository.create({
                  key: args.key,
                  result: null,
                });

                return FN.pipe(
                  TE.tryCatch(
                    () => this.taskDedupeRepository.save(task),
                    (e) => new errors.Exception(e),
                  ),
                  TE.chainW(() => args.fn),
                  TE.chainW((result) => {
                    task.result = result;

                    return TE.tryCatch(
                      () => this.taskDedupeRepository.save(task),
                      (e) => new errors.Exception(e),
                    );
                  }),
                  TE.map((task) => task.result as T),
                );
              }
            }),
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
                return TE.tryCatch(
                  () => this.cacheManager.set(args.key, result, { ttl: ttl / 1000 }),
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
