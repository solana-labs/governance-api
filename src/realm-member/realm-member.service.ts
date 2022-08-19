import { Injectable } from '@nestjs/common';
import { PublicKey } from '@solana/web3.js';
import * as AR from 'fp-ts/Array';
import * as FN from 'fp-ts/function';
import * as OP from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import * as IT from 'io-ts';

import * as base64 from '@lib/base64';
import { BrandedString } from '@lib/brands';
import { Environment } from '@lib/decorators/CurrentEnvironment';
import * as errors from '@lib/errors/gql';
import { HolaplexService } from '@src/holaplex/holaplex.service';

import { RealmMemberSort } from './dto/pagination';
import { RealmMember } from './dto/RealmMember';
import * as queries from './holaplexQueries';

export const RealmMemberCursor = BrandedString('realm member cursor');
export type RealmMemberCursor = IT.TypeOf<typeof RealmMemberCursor>;

const PAGE_SIZE = 25;

@Injectable()
export class RealmMemberService {
  constructor(private readonly holaplexService: HolaplexService) {}

  /**
   * Fetch a list of members in a Realm
   */
  getMembersForRealm(realmPublicKey: PublicKey, environment: Environment) {
    if (environment === 'devnet') {
      return TE.left(new errors.UnsupportedDevnet());
    }

    return FN.pipe(
      this.holaplexService.requestV1(
        {
          query: queries.realmMembers.query,
          variables: {
            realm: realmPublicKey.toBase58(),
          },
        },
        queries.realmMembers.resp,
      ),
      TE.map(({ tokenOwnerRecords }) => tokenOwnerRecords),
      TE.map(
        AR.map(({ address }) => ({
          publicKey: new PublicKey(address),
        })),
      ),
    );
  }

  /**
   * Get a count of the total members in the realm
   */
  getMembersCountForRealm(realmPublicKey: PublicKey, environment: Environment) {
    if (environment === 'devnet') {
      return TE.left(new errors.UnsupportedDevnet());
    }

    return FN.pipe(
      this.holaplexService.requestV1(
        {
          query: queries.realmMembers.query,
          variables: {
            realm: realmPublicKey.toBase58(),
          },
        },
        queries.realmMembers.resp,
      ),
      TE.map(({ tokenOwnerRecords }) => tokenOwnerRecords.length),
    );
  }

  /**
   * Grab the first N members in a realm
   */
  getFirstNMembers(
    realmPublicKey: PublicKey,
    n: number,
    sortOrder: RealmMemberSort,
    environment: Environment,
  ) {
    if (environment === 'devnet') {
      return TE.left(new errors.UnsupportedDevnet());
    }

    return FN.pipe(
      this.getMembersForRealm(realmPublicKey, environment),
      TE.map((members) => {
        switch (sortOrder) {
          default:
            return members.sort(this.sortAlphabetically);
        }
      }),
      TE.map(AR.takeLeft(n)),
    );
  }

  /**
   * Grab the last N members in a realm
   */
  getLastNMembers(
    realmPublicKey: PublicKey,
    n: number,
    sortOrder: RealmMemberSort,
    environment: Environment,
  ) {
    if (environment === 'devnet') {
      return TE.left(new errors.UnsupportedDevnet());
    }

    return FN.pipe(
      this.getMembersForRealm(realmPublicKey, environment),
      TE.map((members) => {
        switch (sortOrder) {
          default:
            return members.sort(this.sortAlphabetically);
        }
      }),
      TE.map(AR.takeRight(n)),
    );
  }

  /**
   * Get a list of members after a cursor
   */
  getNMembersAfter(
    realmPublicKey: PublicKey,
    n: number,
    after: RealmMemberCursor,
    sortOrder: RealmMemberSort,
    environment: Environment,
  ) {
    const parsedCursor = this.fromCursor(after);

    if (parsedCursor.sortOrder !== sortOrder) {
      return TE.left(new errors.MalformedData());
    }

    return FN.pipe(
      this.getMembersForRealm(realmPublicKey, environment),
      TE.map((members) => {
        switch (sortOrder) {
          default:
            return members.sort(this.sortAlphabetically);
        }
      }),
      TE.map(AR.dropLeftWhile((member) => !member.publicKey.equals(parsedCursor.member))),
      TE.map(AR.tail),
      TE.map((remainder) => (OP.isNone(remainder) ? [] : AR.takeLeft(n)(remainder.value))),
    );
  }

  /**
   * Get a list of members before a cursor
   */
  getNMembersBefore(
    realmPublicKey: PublicKey,
    n: number,
    before: RealmMemberCursor,
    sortOrder: RealmMemberSort,
    environment: Environment,
  ) {
    const parsedCursor = this.fromCursor(before);

    if (parsedCursor.sortOrder !== sortOrder) {
      return TE.left(new errors.MalformedData());
    }

    return FN.pipe(
      this.getMembersForRealm(realmPublicKey, environment),
      TE.map((members) => {
        switch (sortOrder) {
          default:
            return members.sort(this.sortAlphabetically);
        }
      }),
      TE.map(AR.takeLeftWhile((member) => !member.publicKey.equals(parsedCursor.member))),
      TE.map(AR.takeRight(n)),
    );
  }

  /**
   * Get a GQL compatible list of members
   */
  getGQLMemberList(
    realmPublicKey: PublicKey,
    sortOrder: RealmMemberSort,
    environment: Environment,
    after?: RealmMemberCursor,
    before?: RealmMemberCursor,
    first?: number,
    last?: number,
  ) {
    if (first) {
      return FN.pipe(
        this.getFirstNMembers(realmPublicKey, first, sortOrder, environment),
        TE.map((members) => {
          const edges = members.map((member) => this.buildEdge(member, sortOrder));

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
        this.getLastNMembers(realmPublicKey, last, sortOrder, environment),
        TE.map((members) => {
          const edges = members.map((member) => this.buildEdge(member, sortOrder));

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
        this.getNMembersAfter(
          realmPublicKey,
          PAGE_SIZE,
          after as RealmMemberCursor,
          sortOrder,
          environment,
        ),
        TE.map((members) => {
          const edges = members.map((member) => this.buildEdge(member, sortOrder));

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
        this.getNMembersBefore(
          realmPublicKey,
          PAGE_SIZE,
          before as RealmMemberCursor,
          sortOrder,
          environment,
        ),
        TE.map((members) => {
          const edges = members.map((member) => this.buildEdge(member, sortOrder));

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

    return TE.left(new errors.MalformedData());
  }

  /**
   * Create a cursor
   */
  toCursor<M extends { publicKey: PublicKey }>(member: M, sortOrder: RealmMemberSort) {
    return base64.encode(
      JSON.stringify({
        sortOrder,
        member: member.publicKey.toBase58(),
      }),
    ) as RealmMemberCursor;
  }

  /**
   * Convert a cursor into properties
   */
  fromCursor(cursor: RealmMemberCursor) {
    const decoded = base64.decode(cursor);
    const parsed = JSON.parse(decoded);

    return {
      sortOrder: parsed.sortOrder as RealmMemberSort,
      member: new PublicKey(parsed.member),
    };
  }

  /**
   * Create a GQL list edge
   */
  private buildEdge(member: RealmMember, sort: RealmMemberSort) {
    return {
      node: member,
      cursor: this.toCursor(member, sort),
    };
  }

  /**
   * Sorts a list of members alphabetically
   */
  private sortAlphabetically<M extends { publicKey: PublicKey; name?: string }>(a: M, b: M) {
    if (a.name && b.name) {
      return a.name.toLocaleLowerCase().localeCompare(b.name.toLocaleLowerCase());
    } else if (a.name) {
      return -1;
    } else if (b.name) {
      return 1;
    } else {
      return a.publicKey.toBase58().localeCompare(b.publicKey.toBase58());
    }
  }
}
