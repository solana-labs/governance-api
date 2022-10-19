import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PublicKey } from '@solana/web3.js';
import { compareDesc, format } from 'date-fns';
import * as EI from 'fp-ts/Either';
import { Repository } from 'typeorm';

import * as base64 from '@lib/base64';
import { User } from '@lib/decorators/CurrentUser';
import * as errors from '@lib/errors/gql';
import { Environment } from '@lib/types/Environment';
import { ConfigService } from '@src/config/config.service';
import { exists } from '@src/lib/typeGuards/exists';
import { RealmFeedItemSort } from '@src/realm-feed-item/dto/pagination';
import {
  RealmFeedItem,
  RealmFeedItemPost,
  RealmFeedItemProposal,
} from '@src/realm-feed-item/dto/RealmFeedItem';
import { RealmFeedItem as RealmFeedItemEntity } from '@src/realm-feed-item/entities/RealmFeedItem.entity';
import { RealmFeedItemCursor } from '@src/realm-feed-item/realm-feed-item.gql.service';
import { RealmFeedItemService } from '@src/realm-feed-item/realm-feed-item.service';

const PAGE_SIZE = 25;

@Injectable()
export class EcosystemFeedService {
  constructor(
    @InjectRepository(RealmFeedItemEntity)
    private readonly realmFeedItemRepository: Repository<RealmFeedItemEntity>,
    private readonly configService: ConfigService,
    private readonly realmFeedItemService: RealmFeedItemService,
  ) {}

  /**
   * Convert raw entities into feed items
   */
  async convertEntitiesToFeedItems(
    entities: RealmFeedItemEntity[],
    requestingUser: User | null,
    environment: Environment,
  ) {
    return this.realmFeedItemService.convertMixedFeedEntitiesToFeedItem(
      entities,
      requestingUser,
      environment,
    );
  }

  /**
   * Grab the first N feed items in a realm
   */
  async getFirstNFeedItems(
    requestingUser: User | null,
    n: number,
    sortOrder: RealmFeedItemSort,
    environment: Environment,
  ) {
    if (environment === 'devnet') {
      throw new errors.UnsupportedDevnet();
    }

    const items = await this.realmFeedItemRepository
      .createQueryBuilder('feeditem')
      .where('feeditem.environment = :env', { env: environment })
      .orderBy(this.orderByClause('feeditem', sortOrder))
      .limit(n)
      .getMany();

    return items;
  }

  /**
   * Grab the last N feed items in a realm
   */
  async getLastNFeedItems(
    requestingUser: User | null,
    n: number,
    sortOrder: RealmFeedItemSort,
    environment: Environment,
  ) {
    if (environment === 'devnet') {
      throw new errors.UnsupportedDevnet();
    }

    const items = await this.realmFeedItemRepository
      .createQueryBuilder('feeditem')
      .where('feeditem.environment = :env', { env: environment })
      .orderBy(this.orderByClause('feeditem', sortOrder, false))
      .limit(n)
      .getMany();

    return items.sort(this.sortEntities(sortOrder));
  }

  /**
   * Get a list of feed items after a cursor
   */
  async getNFeedItemsAfter(
    requestingUser: User | null,
    n: number,
    after: RealmFeedItemCursor,
    sortOrder: RealmFeedItemSort,
    environment: Environment,
  ) {
    if (environment === 'devnet') {
      throw new errors.UnsupportedDevnet();
    }

    const parsedCursor = this.fromCursor(after);

    if (parsedCursor.sortOrder !== sortOrder) {
      throw new errors.MalformedRequest();
    }

    const afterClause = this.cursorClause(after, 'feeditem');

    const items = await this.realmFeedItemRepository
      .createQueryBuilder('feeditem')
      .where('feeditem.environment = :env', { env: environment })
      .andWhere(afterClause.clause, afterClause.params)
      .orderBy(this.orderByClause('feeditem', sortOrder))
      .limit(n)
      .getMany();

    return items;
  }

  /**
   * Get a list of feed items before a cursor
   */
  async getNFeedItemsBefore(
    requestingUser: User | null,
    n: number,
    after: RealmFeedItemCursor,
    sortOrder: RealmFeedItemSort,
    environment: Environment,
  ) {
    if (environment === 'devnet') {
      throw new errors.UnsupportedDevnet();
    }

    const parsedCursor = this.fromCursor(after);

    if (parsedCursor.sortOrder !== sortOrder) {
      throw new errors.MalformedRequest();
    }

    const beforeClause = this.cursorClause(after, 'feeditem', false);

    const items = await this.realmFeedItemRepository
      .createQueryBuilder('feeditem')
      .where('feeditem.environment = :env', { env: environment })
      .andWhere(beforeClause.clause, beforeClause.params)
      .orderBy(this.orderByClause('feeditem', sortOrder, false))
      .limit(n)
      .getMany();

    return items.sort(this.sortEntities(sortOrder));
  }

  /**
   * Get a GQL compatible list of feed items
   */
  async getGQLFeedItemsList(
    requestingUser: User | null,
    sortOrder: RealmFeedItemSort,
    environment: Environment,
    after?: RealmFeedItemCursor,
    before?: RealmFeedItemCursor,
    first?: number,
    last?: number,
  ) {
    if (first) {
      const items = await this.getFirstNFeedItems(requestingUser, first, sortOrder, environment);
      const feedItems = await this.convertEntitiesToFeedItems(items, requestingUser, environment);
      const edges = items
        .map((entity) =>
          feedItems[entity.id] ? this.buildEdge(entity, feedItems[entity.id], sortOrder) : null,
        )
        .filter(exists);

      return {
        edges,
        pageInfo: {
          hasNextPage: edges.length > 0,
          hasPreviousPage: false,
          startCursor: null,
          endCursor: edges[edges.length - 1]?.cursor,
        },
      };
    }

    if (last) {
      const items = await this.getLastNFeedItems(requestingUser, last, sortOrder, environment);
      const feedItems = await this.convertEntitiesToFeedItems(items, requestingUser, environment);
      const edges = items
        .map((entity) =>
          feedItems[entity.id] ? this.buildEdge(entity, feedItems[entity.id], sortOrder) : null,
        )
        .filter(exists);

      return {
        edges,
        pageInfo: {
          hasNextPage: false,
          hasPreviousPage: edges.length > 0,
          startCursor: edges[0]?.cursor,
          endCursor: null,
        },
      };
    }

    if (after) {
      const items = await this.getNFeedItemsAfter(
        requestingUser,
        PAGE_SIZE,
        after as RealmFeedItemCursor,
        sortOrder,
        environment,
      );
      const feedItems = await this.convertEntitiesToFeedItems(items, requestingUser, environment);
      const edges = items
        .map((entity) =>
          feedItems[entity.id] ? this.buildEdge(entity, feedItems[entity.id], sortOrder) : null,
        )
        .filter(exists);

      return {
        edges,
        pageInfo: {
          hasNextPage: edges.length > 0,
          hasPreviousPage: true,
          startCursor: after,
          endCursor: edges[edges.length - 1]?.cursor,
        },
      };
    }

    if (before) {
      const items = await this.getNFeedItemsBefore(
        requestingUser,
        PAGE_SIZE,
        before as RealmFeedItemCursor,
        sortOrder,
        environment,
      );
      const feedItems = await this.convertEntitiesToFeedItems(items, requestingUser, environment);
      const edges = items
        .map((entity) =>
          feedItems[entity.id] ? this.buildEdge(entity, feedItems[entity.id], sortOrder) : null,
        )
        .filter(exists);

      return {
        edges,
        pageInfo: {
          hasNextPage: true,
          hasPreviousPage: edges.length > 0,
          startCursor: edges[0]?.cursor,
          endCursor: before,
        },
      };
    }

    throw new errors.MalformedRequest();
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
          [`((${name}.metadata->'relevanceScore')::decimal + ((to_char(${name}.updated, 'YYYYMMDDHH24MI')::decimal) / 10))`]:
            desc,
        };
      case RealmFeedItemSort.TopAllTime:
        return {
          [`${name}.metadata->'topAllTimeScore'`]: desc,
        };
    }
  }
}
