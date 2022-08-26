import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PublicKey } from '@solana/web3.js';
import { compareDesc, format } from 'date-fns';
import * as FN from 'fp-ts/function';
import * as TE from 'fp-ts/TaskEither';
import * as IT from 'io-ts';
import { Repository } from 'typeorm';

import * as base64 from '@lib/base64';
import { BrandedString } from '@lib/brands';
import * as errors from '@lib/errors/gql';
import { Environment } from '@lib/types/Environment';

import { RealmFeedItemSort } from './dto/pagination';
import { RealmFeedItem } from './dto/RealmFeedItem';
import { RealmFeedItem as RealmFeedItemEntity } from './entities/RealmFeedItem.entity';
import { RealmFeedItemService } from './realm-feed-item.service';

export const RealmFeedItemCursor = BrandedString('realm feed item cursor');
export type RealmFeedItemCursor = IT.TypeOf<typeof RealmFeedItemCursor>;

const PAGE_SIZE = 25;

@Injectable()
export class RealmFeedItemGQLService {
  constructor(
    private readonly realmFeedItemService: RealmFeedItemService,
    @InjectRepository(RealmFeedItemEntity)
    private readonly realmFeedItemRepository: Repository<RealmFeedItemEntity>,
  ) {}

  /**
   * Grab the first N feed items in a realm
   */
  getFirstNFeedItems(
    realmPublicKey: PublicKey,
    requestingUser: PublicKey | null,
    n: number,
    sortOrder: RealmFeedItemSort,
    environment: Environment,
  ) {
    if (environment === 'devnet') {
      return TE.left(new errors.UnsupportedDevnet());
    }

    return FN.pipe(
      this.realmFeedItemService.syncProposalsToFeedItems(realmPublicKey, environment),
      TE.chainW(() =>
        TE.tryCatch(
          () =>
            this.realmFeedItemRepository
              .createQueryBuilder('feeditem')
              .where('feeditem.environment = :env', { env: environment })
              .andWhere('feeditem.realmPublicKeyStr = :pk', { pk: realmPublicKey.toBase58() })
              .orderBy(this.orderByClause('feeditem', sortOrder))
              .limit(n)
              .getMany(),
          (e) => new errors.Exception(e),
        ),
      ),
    );
  }

  /**
   * Grab the last N feed items in a realm
   */
  getLastNFeedItems(
    realmPublicKey: PublicKey,
    requestingUser: PublicKey | null,
    n: number,
    sortOrder: RealmFeedItemSort,
    environment: Environment,
  ) {
    if (environment === 'devnet') {
      return TE.left(new errors.UnsupportedDevnet());
    }

    return FN.pipe(
      this.realmFeedItemService.syncProposalsToFeedItems(realmPublicKey, environment),
      TE.chainW(() =>
        TE.tryCatch(
          () =>
            this.realmFeedItemRepository
              .createQueryBuilder('feeditem')
              .where('feeditem.environment = :env', { env: environment })
              .andWhere('feeditem.realmPublicKeyStr = :pk', { pk: realmPublicKey.toBase58() })
              .orderBy(this.orderByClause('feeditem', sortOrder, false))
              .limit(n)
              .getMany(),
          (e) => new errors.Exception(e),
        ),
      ),
      // We fetched items in "reverse" since we were pulling from the end, now we need to
      // resort them
      TE.map((entities) => entities.sort(this.sortEntities(sortOrder))),
    );
  }

  /**
   * Get a list of feed items after a cursor
   */
  getNFeedItemsAfter(
    realmPublicKey: PublicKey,
    requestingUser: PublicKey | null,
    n: number,
    after: RealmFeedItemCursor,
    sortOrder: RealmFeedItemSort,
    environment: Environment,
  ) {
    if (environment === 'devnet') {
      return TE.left(new errors.UnsupportedDevnet());
    }

    const parsedCursor = this.fromCursor(after);

    if (parsedCursor.sortOrder !== sortOrder) {
      return TE.left(new errors.MalformedRequest());
    }

    const afterClause = this.cursorClause(after, 'feeditem');

    return FN.pipe(
      this.realmFeedItemService.syncProposalsToFeedItems(realmPublicKey, environment),
      TE.chainW(() =>
        TE.tryCatch(
          () =>
            this.realmFeedItemRepository
              .createQueryBuilder('feeditem')
              .where('feeditem.environment = :env', { env: environment })
              .andWhere('feeditem.realmPublicKeyStr = :pk', { pk: realmPublicKey.toBase58() })
              .andWhere(afterClause.clause, afterClause.params)
              .orderBy(this.orderByClause('feeditem', sortOrder))
              .limit(n)
              .getMany(),
          (e) => new errors.Exception(e),
        ),
      ),
    );
  }

  /**
   * Get a list of feed items before a cursor
   */
  getNFeedItemsBefore(
    realmPublicKey: PublicKey,
    requestingUser: PublicKey | null,
    n: number,
    after: RealmFeedItemCursor,
    sortOrder: RealmFeedItemSort,
    environment: Environment,
  ) {
    if (environment === 'devnet') {
      return TE.left(new errors.UnsupportedDevnet());
    }

    const parsedCursor = this.fromCursor(after);

    if (parsedCursor.sortOrder !== sortOrder) {
      return TE.left(new errors.MalformedRequest());
    }

    const beforeClause = this.cursorClause(after, 'feeditem', false);

    return FN.pipe(
      this.realmFeedItemService.syncProposalsToFeedItems(realmPublicKey, environment),
      TE.chainW(() =>
        TE.tryCatch(
          () =>
            this.realmFeedItemRepository
              .createQueryBuilder('feeditem')
              .where('feeditem.environment = :env', { env: environment })
              .andWhere('feeditem.realmPublicKeyStr = :pk', { pk: realmPublicKey.toBase58() })
              .andWhere(beforeClause.clause, beforeClause.params)
              .orderBy(this.orderByClause('feeditem', sortOrder, false))
              .limit(n)
              .getMany(),
          (e) => new errors.Exception(e),
        ),
      ),
      // We fetched items in "reverse" since we were pulling from the end, now we need to
      // resort them
      TE.map((entities) => entities.sort(this.sortEntities(sortOrder))),
    );
  }

  /**
   * Get a GQL compatible list of feed items
   */
  getGQLFeedItemsList(
    realmPublicKey: PublicKey,
    requestingUser: PublicKey | null,
    sortOrder: RealmFeedItemSort,
    environment: Environment,
    after?: RealmFeedItemCursor,
    before?: RealmFeedItemCursor,
    first?: number,
    last?: number,
  ) {
    if (first) {
      return FN.pipe(
        this.getFirstNFeedItems(realmPublicKey, requestingUser, first, sortOrder, environment),
        TE.bindTo('entities'),
        TE.bindW('feedItems', ({ entities }) =>
          this.realmFeedItemService.convertEntitiesToFeedItems(
            realmPublicKey,
            entities,
            requestingUser,
            environment,
          ),
        ),
        TE.map(({ entities, feedItems }) => {
          const edges = entities.map((entity) =>
            this.buildEdge(entity, feedItems[entity.id], sortOrder),
          );

          return {
            edges,
            pageInfo: {
              hasNextPage: edges.length > 0,
              hasPreviousPage: false,
              startCursor: null,
              endCursor: edges[edges.length - 1]?.cursor,
            },
          };
        }),
      );
    }

    if (last) {
      return FN.pipe(
        this.getLastNFeedItems(realmPublicKey, requestingUser, last, sortOrder, environment),
        TE.bindTo('entities'),
        TE.bindW('feedItems', ({ entities }) =>
          this.realmFeedItemService.convertEntitiesToFeedItems(
            realmPublicKey,
            entities,
            requestingUser,
            environment,
          ),
        ),
        TE.map(({ entities, feedItems }) => {
          const edges = entities.map((entity) =>
            this.buildEdge(entity, feedItems[entity.id], sortOrder),
          );

          return {
            edges,
            pageInfo: {
              hasNextPage: false,
              hasPreviousPage: edges.length > 0,
              startCursor: edges[0]?.cursor,
              endCursor: null,
            },
          };
        }),
      );
    }

    if (after) {
      return FN.pipe(
        this.getNFeedItemsAfter(
          realmPublicKey,
          requestingUser,
          PAGE_SIZE,
          after as RealmFeedItemCursor,
          sortOrder,
          environment,
        ),
        TE.bindTo('entities'),
        TE.bindW('feedItems', ({ entities }) =>
          this.realmFeedItemService.convertEntitiesToFeedItems(
            realmPublicKey,
            entities,
            requestingUser,
            environment,
          ),
        ),
        TE.map(({ entities, feedItems }) => {
          const edges = entities.map((entity) =>
            this.buildEdge(entity, feedItems[entity.id], sortOrder),
          );

          return {
            edges,
            pageInfo: {
              hasNextPage: edges.length > 0,
              hasPreviousPage: true,
              startCursor: after,
              endCursor: edges[edges.length - 1]?.cursor,
            },
          };
        }),
      );
    }

    if (before) {
      return FN.pipe(
        this.getNFeedItemsBefore(
          realmPublicKey,
          requestingUser,
          PAGE_SIZE,
          before as RealmFeedItemCursor,
          sortOrder,
          environment,
        ),
        TE.bindTo('entities'),
        TE.bindW('feedItems', ({ entities }) =>
          this.realmFeedItemService.convertEntitiesToFeedItems(
            realmPublicKey,
            entities,
            requestingUser,
            environment,
          ),
        ),
        TE.map(({ entities, feedItems }) => {
          const edges = entities.map((entity) =>
            this.buildEdge(entity, feedItems[entity.id], sortOrder),
          );

          return {
            edges,
            pageInfo: {
              hasNextPage: true,
              hasPreviousPage: edges.length > 0,
              startCursor: edges[0]?.cursor,
              endCursor: before,
            },
          };
        }),
      );
    }

    return TE.left(new errors.MalformedRequest());
  }

  /**
   * Create a cursor
   */
  toCursor(feedItem: RealmFeedItemEntity, sortOrder: RealmFeedItemSort) {
    let id: string;

    switch (sortOrder) {
      case RealmFeedItemSort.New: {
        id = feedItem.updated.getTime().toString();
        break;
      }
      case RealmFeedItemSort.Relevance: {
        const updatedAsNumber = parseInt(format(feedItem.updated, 'yyyyMMddHHmm'), 10);
        const score = feedItem.metadata.relevanceScore + updatedAsNumber / 10;
        id = score.toString();
        break;
      }
      case RealmFeedItemSort.TopAllTime: {
        id = feedItem.metadata.topAllTimeScore.toString();
        break;
      }
    }

    return base64.encode(
      JSON.stringify({
        sortOrder,
        feedItem: id,
      }),
    ) as RealmFeedItemCursor;
  }

  /**
   * Convert a cursor into properties
   */
  fromCursor(cursor: RealmFeedItemCursor) {
    const decoded = base64.decode(cursor);
    const parsed = JSON.parse(decoded);
    const sortOrder = parsed.sortOrder as RealmFeedItemSort;

    switch (sortOrder) {
      case RealmFeedItemSort.New:
        return {
          sortOrder,
          feedItem: new Date(parseInt(parsed.feedItem, 10)),
        };
      case RealmFeedItemSort.Relevance:
        return {
          sortOrder,
          feedItem: parseFloat(parsed.feedItem),
        };
      case RealmFeedItemSort.TopAllTime:
        return {
          sortOrder,
          feedItem: parseFloat(parsed.feedItem),
        };
    }
  }

  /**
   * Create a GQL list edge
   */
  private buildEdge(
    entity: RealmFeedItemEntity,
    feedItem: typeof RealmFeedItem,
    sort: RealmFeedItemSort,
  ) {
    return {
      node: feedItem,
      cursor: this.toCursor(entity, sort),
    };
  }

  /**
   * Get a sort function for a sort order
   */
  private sortEntities(sortOrder: RealmFeedItemSort) {
    return (a: RealmFeedItemEntity, b: RealmFeedItemEntity) => {
      switch (sortOrder) {
        case RealmFeedItemSort.New: {
          return compareDesc(a.updated, b.updated);
        }
        case RealmFeedItemSort.Relevance: {
          if (a.metadata.relevanceScore === b.metadata.relevanceScore) {
            return this.sortEntities(RealmFeedItemSort.New)(a, b);
          }

          return b.metadata.relevanceScore - a.metadata.relevanceScore;
        }
        case RealmFeedItemSort.TopAllTime: {
          if (a.metadata.topAllTimeScore === b.metadata.topAllTimeScore) {
            return this.sortEntities(RealmFeedItemSort.New)(a, b);
          }

          return b.metadata.topAllTimeScore - a.metadata.topAllTimeScore;
        }
      }
    };
  }

  /**
   * Creates a clause that helps find entities before or after another entity
   */
  private cursorClause(cursor: RealmFeedItemCursor, name: string, forwards = true) {
    const parsedCursor = this.fromCursor(cursor);

    const { sortOrder, feedItem } = parsedCursor;

    if (sortOrder === RealmFeedItemSort.New) {
      return {
        clause: `${name}.updated ${forwards ? '<' : '>'} :date`,
        params: { date: feedItem },
      };
    } else if (sortOrder === RealmFeedItemSort.Relevance) {
      return {
        clause: `((${name}.metadata->'relevanceScore')::decimal + ((to_char(${name}.updated, 'YYYYMMDDHH24MI')::decimal) / 10)) ${
          forwards ? '<' : '>'
        } :score`,
        params: { score: feedItem },
      };
    } else {
      return {
        clause: `${name}.metadata->'topAllTimeScore' ${forwards ? '<' : '>'} :score`,
        params: { score: feedItem },
      };
    }
  }

  /**
   * Creates a orderBy clause
   */
  private orderByClause(name: string, sortOrder: RealmFeedItemSort, forwards = true) {
    const desc = forwards ? ('DESC' as const) : ('ASC' as const);

    switch (sortOrder) {
      case RealmFeedItemSort.New:
        return {
          [`${name}.updated`]: desc,
        };
      case RealmFeedItemSort.Relevance:
        return {
          [`((${name}.metadata->'relevanceScore')::decimal + ((to_char(${name}.updated, 'YYYYMMDDHHMI')::decimal) / 10))`]:
            desc,
        };
      case RealmFeedItemSort.TopAllTime:
        return {
          [`${name}.metadata->'topAllTimeScore'`]: desc,
        };
    }
  }
}
