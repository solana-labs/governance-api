import { Injectable } from '@nestjs/common';
import { PublicKey } from '@solana/web3.js';
import * as AR from 'fp-ts/Array';
import * as FN from 'fp-ts/function';
import * as OP from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import * as IT from 'io-ts';

import * as base64 from '@lib/base64';
import { BrandedString } from '@lib/brands';
import * as errors from '@lib/errors/gql';
import { Environment } from '@lib/types/Environment';

import { RealmProposalSort } from './dto/pagination';
import { RealmProposal } from './dto/RealmProposal';
import { RealmProposalService } from './realm-proposal.service';

export const RealmProposalCursor = BrandedString('realm proposal cursor');
export type RealmProposalCursor = IT.TypeOf<typeof RealmProposalCursor>;

const PAGE_SIZE = 25;

@Injectable()
export class RealmProposalGQLService {
  constructor(private readonly realmProposalService: RealmProposalService) {}

  /**
   * Grab the frist N proposals in a realm
   */
  getFirstNProposals(
    realmPublicKey: PublicKey,
    requestingUser: PublicKey | null,
    n: number,
    sortOrder: RealmProposalSort,
    environment: Environment,
  ) {
    if (environment === 'devnet') {
      return TE.left(new errors.UnsupportedDevnet());
    }

    return FN.pipe(
      this.realmProposalService.getProposalsForRealmAndUser(
        realmPublicKey,
        requestingUser,
        sortOrder,
        environment,
      ),
      TE.map(AR.takeLeft(n)),
    );
  }

  /**
   * Grab the last N proposals in a realm
   */
  getLastNProposals(
    realmPublicKey: PublicKey,
    requestingUser: PublicKey | null,
    n: number,
    sortOrder: RealmProposalSort,
    environment: Environment,
  ) {
    if (environment === 'devnet') {
      return TE.left(new errors.UnsupportedDevnet());
    }

    return FN.pipe(
      this.realmProposalService.getProposalsForRealmAndUser(
        realmPublicKey,
        requestingUser,
        sortOrder,
        environment,
      ),
      TE.map(AR.takeRight(n)),
    );
  }

  /**
   * Get a list of proposals after a cursor
   */
  getNProposalsAfter(
    realmPublicKey: PublicKey,
    requestingUser: PublicKey | null,
    n: number,
    after: RealmProposalCursor,
    sortOrder: RealmProposalSort,
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
      this.realmProposalService.getProposalsForRealmAndUser(
        realmPublicKey,
        requestingUser,
        sortOrder,
        environment,
      ),
      TE.map(AR.dropLeftWhile((proposal) => !proposal.publicKey.equals(parsedCursor.proposal))),
      TE.map(AR.tail),
      TE.map((remainder) => (OP.isNone(remainder) ? [] : AR.takeLeft(n)(remainder.value))),
    );
  }

  /**
   * Get a list of proposals before a cursor
   */
  getNProposalsBefore(
    realmPublicKey: PublicKey,
    requestingUser: PublicKey | null,
    n: number,
    before: RealmProposalCursor,
    sortOrder: RealmProposalSort,
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
      this.realmProposalService.getProposalsForRealmAndUser(
        realmPublicKey,
        requestingUser,
        sortOrder,
        environment,
      ),
      TE.map(AR.takeLeftWhile((proposal) => !proposal.publicKey.equals(parsedCursor.proposal))),
      TE.map(AR.takeRight(n)),
    );
  }

  /**
   * Get a GQL compatible list of proposals
   */
  getGQLProposalList(
    realmPublicKey: PublicKey,
    requestingUser: PublicKey | null,
    sortOrder: RealmProposalSort,
    environment: Environment,
    after?: RealmProposalCursor,
    before?: RealmProposalCursor,
    first?: number,
    last?: number,
  ) {
    if (first) {
      return FN.pipe(
        this.getFirstNProposals(realmPublicKey, requestingUser, first, sortOrder, environment),
        TE.map((proposals) => {
          const edges = proposals.map((proposal) => this.buildEdge(proposal, sortOrder));

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
        this.getLastNProposals(realmPublicKey, requestingUser, last, sortOrder, environment),
        TE.map((proposals) => {
          const edges = proposals.map((proposal) => this.buildEdge(proposal, sortOrder));

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
        this.getNProposalsAfter(
          realmPublicKey,
          requestingUser,
          PAGE_SIZE,
          after as RealmProposalCursor,
          sortOrder,
          environment,
        ),
        TE.map((proposals) => {
          const edges = proposals.map((proposal) => this.buildEdge(proposal, sortOrder));

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
        this.getNProposalsBefore(
          realmPublicKey,
          requestingUser,
          PAGE_SIZE,
          before as RealmProposalCursor,
          sortOrder,
          environment,
        ),
        TE.map((proposals) => {
          const edges = proposals.map((proposal) => this.buildEdge(proposal, sortOrder));

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
  toCursor<M extends { publicKey: PublicKey }>(proposal: M, sortOrder: RealmProposalSort) {
    return base64.encode(
      JSON.stringify({
        sortOrder,
        proposal: proposal.publicKey.toBase58(),
      }),
    ) as RealmProposalCursor;
  }

  /**
   * Convert a cursor into properties
   */
  fromCursor(cursor: RealmProposalCursor) {
    const decoded = base64.decode(cursor);
    const parsed = JSON.parse(decoded);

    return {
      sortOrder: parsed.sortOrder as RealmProposalSort,
      proposal: new PublicKey(parsed.proposal),
    };
  }

  /**
   * Create a GQL list edge
   */
  private buildEdge(proposal: RealmProposal, sort: RealmProposalSort) {
    return {
      node: proposal,
      cursor: this.toCursor(proposal, sort),
    };
  }
}
