import { Injectable } from '@nestjs/common';
import {
  getGovernanceAccounts,
  Governance,
  ProposalState,
  pubkeyFilter,
} from '@solana/spl-governance';
import { Connection, PublicKey } from '@solana/web3.js';
import { compareDesc } from 'date-fns';
import * as AR from 'fp-ts/Array';
import * as FN from 'fp-ts/function';
import * as OP from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import * as IT from 'io-ts';

import * as base64 from '@lib/base64';
import { BrandedString } from '@lib/brands';
import * as errors from '@lib/errors/gql';
import { Environment } from '@lib/types/Environment';
import { HolaplexService } from '@src/holaplex/holaplex.service';
import { RealmSettingsService } from '@src/realm-settings/realm-settings.service';

import { RealmProposalSort } from './dto/pagination';
import { RealmProposal } from './dto/RealmProposal';
import { RealmProposalState } from './dto/RealmProposalState';
import * as queries from './holaplexQueries';

export const RealmProposalCursor = BrandedString('realm proposal cursor');
export type RealmProposalCursor = IT.TypeOf<typeof RealmProposalCursor>;

const PAGE_SIZE = 25;

@Injectable()
export class RealmProposalService {
  constructor(
    private readonly holaplexService: HolaplexService,
    private readonly realmSettingsService: RealmSettingsService,
  ) {}

  /**
   * Grab the frist N proposals in a realm
   */
  getFirstNProposals(
    realmPublicKey: PublicKey,
    n: number,
    sortOrder: RealmProposalSort,
    environment: Environment,
  ) {
    if (environment === 'devnet') {
      return TE.left(new errors.UnsupportedDevnet());
    }

    return FN.pipe(
      this.getProposalsForRealm(realmPublicKey, environment),
      TE.map((proposals) => {
        switch (sortOrder) {
          case RealmProposalSort.Alphabetical:
            return proposals.sort(this.sortAlphabetically);
          case RealmProposalSort.Relevance:
            return proposals.sort(this.sortRelevance);
          default:
            return proposals.sort(this.sortTime);
        }
      }),
      TE.map(AR.takeLeft(n)),
    );
  }

  /**
   * Grab the last N proposals in a realm
   */
  getLastNProposals(
    realmPublicKey: PublicKey,
    n: number,
    sortOrder: RealmProposalSort,
    environment: Environment,
  ) {
    if (environment === 'devnet') {
      return TE.left(new errors.UnsupportedDevnet());
    }

    return FN.pipe(
      this.getProposalsForRealm(realmPublicKey, environment),
      TE.map((proposals) => {
        switch (sortOrder) {
          case RealmProposalSort.Alphabetical:
            return proposals.sort(this.sortAlphabetically);
          case RealmProposalSort.Relevance:
            return proposals.sort(this.sortRelevance);
          default:
            return proposals.sort(this.sortTime);
        }
      }),
      TE.map(AR.takeRight(n)),
    );
  }

  /**
   * Get a list of proposals after a cursor
   */
  getNProposalsAfter(
    realmPublicKey: PublicKey,
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
      this.getProposalsForRealm(realmPublicKey, environment),
      TE.map((proposals) => {
        switch (sortOrder) {
          case RealmProposalSort.Alphabetical:
            return proposals.sort(this.sortAlphabetically);
          case RealmProposalSort.Relevance:
            return proposals.sort(this.sortRelevance);
          default:
            return proposals.sort(this.sortTime);
        }
      }),
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
      this.getProposalsForRealm(realmPublicKey, environment),
      TE.map((proposals) => {
        switch (sortOrder) {
          case RealmProposalSort.Alphabetical:
            return proposals.sort(this.sortAlphabetically);
          case RealmProposalSort.Relevance:
            return proposals.sort(this.sortRelevance);
          default:
            return proposals.sort(this.sortTime);
        }
      }),
      TE.map(AR.takeLeftWhile((proposal) => !proposal.publicKey.equals(parsedCursor.proposal))),
      TE.map(AR.takeRight(n)),
    );
  }

  /**
   * Get a GQL compatible list of proposals
   */
  getGQLProposalList(
    realmPublicKey: PublicKey,
    sortOrder: RealmProposalSort,
    environment: Environment,
    after?: RealmProposalCursor,
    before?: RealmProposalCursor,
    first?: number,
    last?: number,
  ) {
    if (first) {
      return FN.pipe(
        this.getFirstNProposals(realmPublicKey, first, sortOrder, environment),
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
        this.getLastNProposals(realmPublicKey, last, sortOrder, environment),
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

    return TE.left(new errors.MalformedData());
  }

  /**
   * Fetch a list of proposals in a Realm
   */
  getProposalsForRealm(realmPublicKey: PublicKey, environment: Environment) {
    if (environment === 'devnet') {
      return TE.left(new errors.UnsupportedDevnet());
    }

    return FN.pipe(
      this.getGovernancesForRealm(realmPublicKey, environment),
      TE.chainW((governances) =>
        this.holaplexService.requestV1(
          {
            query: queries.realmProposals.query,
            variables: {
              governances: governances.map((g) => g.toBase58()),
            },
          },
          queries.realmProposals.resp,
        ),
      ),
      TE.map(({ proposals }) => proposals),
      TE.map(AR.map(this.buildProposalFromHolaplexRespose)),
    );
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
   * Convert a Holaplex proposal to a GQL proposal
   */
  private buildProposalFromHolaplexRespose = (
    holaplexProposal: IT.TypeOf<typeof queries.realmProposals.respProposal>,
  ) => {
    return {
      created: new Date(holaplexProposal.draftAt),
      description: holaplexProposal.description,
      publicKey: new PublicKey(holaplexProposal.address),
      state: this.buildProposalStateFromHolaplexResponse(holaplexProposal),
      title: holaplexProposal.name,
      updated: this.buildPropsalUpdatedFromHolaplexResponse(holaplexProposal),
    };
  };

  /**
   * Get the vote state for a proposal from an Holaplex response
   */
  private buildProposalStateFromHolaplexResponse = (
    holaplexProposal: IT.TypeOf<typeof queries.realmProposals.respProposal>,
  ) => {
    let hasInstructions = false;
    let votingEnded = true;

    if (
      holaplexProposal.governance?.governanceConfig?.maxVotingTime &&
      holaplexProposal.state === 'VOTING'
    ) {
      const nowUnixSeconds = Date.now() / 1000;
      const votingAt = holaplexProposal.votingAt
        ? new Date(holaplexProposal.votingAt).getTime() / 1000
        : 0;
      const maxVotingTime = parseInt(
        holaplexProposal.governance.governanceConfig.maxVotingTime,
        10,
      );
      const timeToVoteEnd = votingAt + maxVotingTime - nowUnixSeconds;

      if (timeToVoteEnd > 0) {
        votingEnded = false;
      }
    }

    if (holaplexProposal.proposalOptions.length) {
      for (const option of holaplexProposal.proposalOptions) {
        if (option.transactionsCount > 0) {
          hasInstructions = true;
          break;
        }
      }
    }

    switch (holaplexProposal.state) {
      case 'CANCELLED':
        return RealmProposalState.Cancelled;
      case 'COMPLETED':
        return RealmProposalState.Completed;
      case 'DEFEATED':
        return RealmProposalState.Defeated;
      case 'DRAFT':
        return RealmProposalState.Draft;
      case 'EXECUTING':
        return RealmProposalState.Executable;
      case 'EXECUTING_WITH_ERRORS':
        return RealmProposalState.ExecutingWithErrors;
      case 'SIGNING_OFF':
        return RealmProposalState.SigningOff;
      case 'SUCCEEDED':
        return !hasInstructions ? RealmProposalState.Completed : RealmProposalState.Executable;
      case 'VOTING':
        return votingEnded ? RealmProposalState.Finalizing : RealmProposalState.Voting;
    }
  };

  /**
   * Get a timestamp of when the proposal was last updated
   */
  private buildPropsalUpdatedFromHolaplexResponse = (
    holaplexProposal: IT.TypeOf<typeof queries.realmProposals.respProposal>,
  ) => {
    if (holaplexProposal.closedAt) {
      return new Date(holaplexProposal.closedAt);
    } else if (holaplexProposal.executingAt) {
      return new Date(holaplexProposal.executingAt);
    } else if (holaplexProposal.votingCompletedAt) {
      return new Date(holaplexProposal.votingCompletedAt);
    } else if (holaplexProposal.votingAt) {
      return new Date(holaplexProposal.votingAt);
    } else if (holaplexProposal.startVotingAt) {
      return new Date(holaplexProposal.startVotingAt);
    } else if (holaplexProposal.signingOffAt) {
      return new Date(holaplexProposal.signingOffAt);
    } else {
      return new Date(holaplexProposal.draftAt);
    }
  };

  /**
   * Create a GQL list edge
   */
  private buildEdge(proposal: RealmProposal, sort: RealmProposalSort) {
    return {
      node: proposal,
      cursor: this.toCursor(proposal, sort),
    };
  }

  /**
   * Get a list of governances for a realm
   */
  private getGovernancesForRealm(realmPublicKey: PublicKey, environment: Environment) {
    if (environment === 'devnet') {
      return TE.left(new errors.UnsupportedDevnet());
    }

    return FN.pipe(
      this.realmSettingsService.getCodeCommittedSettingsForRealm(realmPublicKey, environment),
      TE.chainW(({ programId }) =>
        TE.tryCatch(
          () =>
            getGovernanceAccounts(
              new Connection('https://rpc.theindex.io'),
              new PublicKey(programId),
              Governance,
              [pubkeyFilter(1, realmPublicKey)],
            ),
          (e) => new errors.Exception(e),
        ),
      ),
      TE.map(AR.map((governance) => governance.pubkey)),
    );
  }

  /**
   * Sorts a list of proposals alphabetically
   */
  private sortAlphabetically<P extends { publicKey: PublicKey; title: string }>(a: P, b: P) {
    if (a.title && b.title) {
      return a.title.toLocaleLowerCase().localeCompare(b.title.toLocaleLowerCase());
    } else if (a.title) {
      return -1;
    } else if (b.title) {
      return 1;
    } else {
      return a.publicKey.toBase58().localeCompare(b.publicKey.toBase58());
    }
  }

  /**
   * Sorts a list of proposals by relevance
   */
  private sortRelevance = <
    P extends { publicKey: PublicKey; updated: Date; state: RealmProposalState },
  >(
    a: P,
    b: P,
  ) => {
    if (a.state === RealmProposalState.Voting && b.state !== RealmProposalState.Voting) {
      return -1;
    } else if (a.state !== RealmProposalState.Voting && b.state === RealmProposalState.Voting) {
      return 1;
    } else if (
      a.state === RealmProposalState.Executable &&
      b.state !== RealmProposalState.Executable
    ) {
      return -1;
    } else if (
      a.state !== RealmProposalState.Executable &&
      b.state === RealmProposalState.Executable
    ) {
      return 1;
    } else if (
      a.state === RealmProposalState.Finalizing &&
      b.state !== RealmProposalState.Finalizing
    ) {
      return -1;
    } else if (
      a.state !== RealmProposalState.Finalizing &&
      b.state === RealmProposalState.Finalizing
    ) {
      return 1;
    } else {
      return this.sortTime(a, b);
    }
  };

  /**
   * Sorts a list of proposals by time
   */
  private sortTime = <P extends { publicKey: PublicKey; updated: Date }>(a: P, b: P) => {
    const compare = compareDesc(a.updated, b.updated);

    if (compare === 0) {
      return a.publicKey.toBase58().localeCompare(b.publicKey.toBase58());
    } else {
      return compare;
    }
  };
}
