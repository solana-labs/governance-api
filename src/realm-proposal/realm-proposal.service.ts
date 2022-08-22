import { Injectable } from '@nestjs/common';
import {
  getGovernanceAccounts,
  Governance,
  pubkeyFilter,
  MemcmpFilter,
} from '@solana/spl-governance';
import { Connection, PublicKey } from '@solana/web3.js';
import BigNumber from 'bignumber.js';
import { compareDesc } from 'date-fns';
import * as AR from 'fp-ts/Array';
import * as FN from 'fp-ts/function';
import * as TE from 'fp-ts/TaskEither';
import * as IT from 'io-ts';

import * as errors from '@lib/errors/gql';
import { Environment } from '@lib/types/Environment';
import { HolaplexService } from '@src/holaplex/holaplex.service';
import { RealmSettingsService } from '@src/realm-settings/realm-settings.service';

import { RealmProposalSort } from './dto/pagination';
import { RealmProposalState } from './dto/RealmProposalState';
import { RealmProposalUserVote, RealmProposalUserVoteType } from './dto/RealmProposalUserVote';
import * as queries from './holaplexQueries';

@Injectable()
export class RealmProposalService {
  constructor(
    private readonly holaplexService: HolaplexService,
    private readonly realmSettingsService: RealmSettingsService,
  ) {}

  /**
   * Fetch a list of proposals in a Realm
   */
  getProposalsForRealm(
    realmPublicKey: PublicKey,
    requestingUser: PublicKey | null,
    sortOrder: RealmProposalSort,
    environment: Environment,
  ) {
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
      TE.bindTo('proposals'),
      TE.bind('voteRecords', ({ proposals }) =>
        FN.pipe(
          requestingUser
            ? this.holaplexService.requestV1(
                {
                  query: queries.voteRecords.query,
                  variables: {
                    user: requestingUser.toBase58(),
                    proposals: proposals.map((p) => p.address),
                  },
                },
                queries.voteRecords.resp,
              )
            : TE.right({ voteRecords: [] }),
          TE.map(({ voteRecords }) => voteRecords),
        ),
      ),
      TE.map(({ proposals, voteRecords }) =>
        proposals.map((proposal) => this.buildProposalFromHolaplexRespose(proposal, voteRecords)),
      ),
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
    );
  }

  /**
   * Convert a Holaplex proposal to a GQL proposal
   */
  private buildProposalFromHolaplexRespose = (
    holaplexProposal: IT.TypeOf<typeof queries.realmProposals.respProposal>,
    voteRecords: IT.TypeOf<typeof queries.voteRecords.respVoteRecord>[],
  ) => {
    return {
      created: new Date(holaplexProposal.draftAt),
      description: holaplexProposal.description,
      publicKey: new PublicKey(holaplexProposal.address),
      myVote: this.buildProposalUserVote(voteRecords, holaplexProposal.address),
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
      default:
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

  /** Get the user vote for a proposal */
  private buildProposalUserVote = (
    voteRecords: IT.TypeOf<typeof queries.voteRecords.respVoteRecord>[],
    proposalAddress: string,
  ): RealmProposalUserVote | null => {
    const record = voteRecords.find((record) => record.proposal.address === proposalAddress);

    if (record) {
      let type: RealmProposalUserVoteType | null = null;

      switch (record.vote) {
        case 'APPROVE': {
          type = RealmProposalUserVoteType.Yes;
          break;
        }
        case 'DENY': {
          type = RealmProposalUserVoteType.No;
          break;
        }
        case 'ABSTAIN': {
          type = RealmProposalUserVoteType.Abstain;
          break;
        }
        case 'VETO': {
          type = RealmProposalUserVoteType.Veto;
          break;
        }
      }

      if (type) {
        return {
          type,
          weight: new BigNumber(record.voterWeight),
        };
      }
    }

    return null;
  };

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
              [pubkeyFilter(1, realmPublicKey) as MemcmpFilter],
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
