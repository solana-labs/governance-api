import { getNamespaceByName, nameForDisplay } from '@cardinal/namespaces';
import { CivicProfile } from '@civic/profile';
import { CACHE_MANAGER, Injectable, Inject, Logger } from '@nestjs/common';
import { Connection, PublicKey } from '@solana/web3.js';
import BigNumber from 'bignumber.js';
import { Cache } from 'cache-manager';
import { hoursToMilliseconds } from 'date-fns';
import * as AR from 'fp-ts/Array';
import * as EI from 'fp-ts/Either';
import * as FN from 'fp-ts/function';
import * as OP from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import * as IT from 'io-ts';

import * as base64 from '@lib/base64';
import { BrandedString } from '@lib/brands';
import { Environment } from '@lib/decorators/CurrentEnvironment';
import * as errors from '@lib/errors/gql';
import { abbreviateAddress } from '@lib/textManipulation/abbreviateAddress';
import { ConfigService } from '@src/config/config.service';
import { HolaplexService } from '@src/holaplex/holaplex.service';
import { StaleCacheService } from '@src/stale-cache/stale-cache.service';

import { RealmMemberSort } from './dto/pagination';
import { RealmMember } from './dto/RealmMember';
import * as queries from './holaplexQueries';

export const RealmMemberCursor = BrandedString('realm member cursor');
export type RealmMemberCursor = IT.TypeOf<typeof RealmMemberCursor>;

const ENDPOINT =
  'http://realms-realms-c335.mainnet.rpcpool.com/258d3727-bb96-409d-abea-0b1b4c48af29/';
const PAGE_SIZE = 25;

@Injectable()
export class RealmMemberService {
  private logger = new Logger(RealmMemberService.name);

  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly configService: ConfigService,
    private readonly holaplexService: HolaplexService,
    private readonly staleCacheService: StaleCacheService,
  ) {}

  /**
   * Returns a user's civic handle, if it exists
   */
  getCivicHandleForPublicKey(userPublicKey: PublicKey, environment: Environment) {
    if (environment === 'devnet') {
      return TE.left(new errors.UnsupportedDevnet());
    }

    const cacheKey = `civic-handle-${userPublicKey.toBase58()}`;

    return FN.pipe(
      TE.tryCatch(
        () =>
          this.cacheManager.get<{ handle: string; avatarlUrl?: string; isVerified: boolean }>(
            cacheKey,
          ),
        (e) => new errors.Exception(e),
      ),
      TE.chainW((result) =>
        result
          ? TE.right(result)
          : FN.pipe(
              TE.tryCatch(
                () => this.getCivicDetails(userPublicKey),
                (e) => new errors.Exception(e),
              ),
              TE.chainW((result) =>
                TE.tryCatch(
                  () => this.cacheManager.set(cacheKey, result, 60 * 2),
                  (e) => new errors.Exception(e),
                ),
              ),
            ),
      ),
    );
  }

  /**
   * Fetch a list of members in a Realm
   */
  getMembersForRealm(realmPublicKey: PublicKey, environment: Environment) {
    if (environment === 'devnet') {
      return TE.left(new errors.UnsupportedDevnet());
    }

    return FN.pipe(
      TE.tryCatch(
        () => this.holaplexGetTokenOwnerRecords(realmPublicKey),
        (e) => new errors.Exception(e),
      ),
      TE.map(
        AR.map(({ address, governingTokenDepositAmount }) => ({
          publicKey: new PublicKey(address),
          votingPower: new BigNumber(governingTokenDepositAmount),
        })),
      ),
    );
  }

  /**
   * Get a count of the total members in the realm
   */
  async getMembersCountForRealm(realmPublicKey: PublicKey, environment: Environment) {
    if (environment === 'devnet') {
      throw new errors.UnsupportedDevnet();
    }

    try {
      const tors = await this.holaplexGetTokenOwnerRecords(realmPublicKey);
      return tors.length;
    } catch (e) {
      this.logger.error(e);
      return 0;
    }
  }

  /**
   * Returns a user's twitter handle, if it exists
   */
  getTwitterHandleForPublicKey(userPublicKey: PublicKey, environment: Environment) {
    if (environment === 'devnet') {
      return TE.left(new errors.UnsupportedDevnet());
    }

    const cacheKey = `twitter-handle-${userPublicKey.toBase58()}`;

    return FN.pipe(
      TE.tryCatch(
        () => this.cacheManager.get<{ handle: string; avatarlUrl?: string }>(cacheKey),
        (e) => new errors.Exception(e),
      ),
      TE.chainW((result) =>
        result
          ? TE.right(result)
          : FN.pipe(
              TE.tryCatch(
                () =>
                  this.getTwitterDetails(
                    userPublicKey,
                    this.configService.get('external.twitterBearerKey'),
                  ),
                (e) => new errors.Exception(e),
              ),
              TE.chainW((result) =>
                TE.tryCatch(
                  () => this.cacheManager.set(cacheKey, result, 60 * 2),
                  (e) => new errors.Exception(e),
                ),
              ),
            ),
      ),
    );
  }

  /**
   * Get a single handle name for a user's public key
   */
  async getHandleName(userPublicKey: PublicKey, environment: Environment) {
    const civicDetails = await this.getCivicHandleForPublicKey(userPublicKey, environment)();

    if (EI.isRight(civicDetails) && civicDetails.right?.handle) {
      return civicDetails.right?.handle;
    }

    const twitterDetails = await this.getTwitterHandleForPublicKey(userPublicKey, environment)();

    if (EI.isRight(twitterDetails) && twitterDetails.right.handle) {
      return twitterDetails.right.handle;
    }

    return abbreviateAddress(userPublicKey);
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
    if (environment === 'devnet') {
      return TE.left(new errors.UnsupportedDevnet());
    }

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
    if (environment === 'devnet') {
      return TE.left(new errors.UnsupportedDevnet());
    }

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
   * Get a list of token owner records from holaplex
   */
  private holaplexGetTokenOwnerRecords = this.staleCacheService.dedupe(
    async (realmPublicKey: PublicKey) => {
      const resp = await this.holaplexService.requestV1(
        {
          query: queries.realmMembers.query,
          variables: {
            realm: realmPublicKey.toBase58(),
          },
        },
        queries.realmMembers.resp,
      )();

      if (EI.isLeft(resp)) {
        throw resp.left;
      }

      return resp.right.tokenOwnerRecords;
    },
    {
      dedupeKey: (pk) => pk.toBase58(),
      maxStaleAgeMs: hoursToMilliseconds(6),
    },
  );

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
   * Get civic details about a user
   */
  private getCivicDetails = this.staleCacheService.dedupe(
    async (publicKey: PublicKey) => {
      const connection = new Connection(ENDPOINT);

      const details = await CivicProfile.get(publicKey.toBase58(), {
        solana: { connection },
      });

      if (details.name) {
        return {
          handle: details.name.value,
          avatarUrl: details.image?.url,
          isVerified: details.name.verified,
        };
      }

      return undefined;
    },
    {
      dedupeKey: (publicKey) => publicKey.toBase58(),
      maxStaleAgeMs: hoursToMilliseconds(1),
    },
  );

  /**
   * Get twitter details about a user
   */
  private getTwitterDetails = this.staleCacheService.dedupe(
    async (publicKey: PublicKey, bearerToken: string) => {
      const connection = new Connection(ENDPOINT);
      const namespace = await getNamespaceByName(connection, 'twitter');
      const displayName = await nameForDisplay(connection, publicKey, namespace.pubkey);
      const username = displayName.replace('@', '');

      return fetch(
        `https://api.twitter.com/2/users/by/username/${username}?user.fields=profile_image_url`,
        {
          method: 'get',
          headers: {
            Authorization: `Bearer ${bearerToken}`,
          },
        },
      )
        .then<{
          data: { profile_image_url: string };
        }>((resp) => resp.json())
        .then((result) => result?.data?.profile_image_url)
        .then((url) => ({
          avatarUrl: url ? url.replace('_normal', '') : undefined,
          handle: displayName,
        }));
    },
    {
      dedupeKey: (publicKey, bearerToken) => publicKey.toBase58() + bearerToken,
      maxStaleAgeMs: hoursToMilliseconds(1),
    },
  );

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
