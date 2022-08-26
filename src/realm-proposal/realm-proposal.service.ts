import { CACHE_MANAGER, Injectable, Inject } from '@nestjs/common';
import { MintInfo } from '@solana/spl-token';
import { PublicKey } from '@solana/web3.js';
import BigNumber from 'bignumber.js';
import { Cache } from 'cache-manager';
import { compareDesc } from 'date-fns';
import * as AR from 'fp-ts/Array';
import * as FN from 'fp-ts/function';
import * as TE from 'fp-ts/TaskEither';
import * as IT from 'io-ts';

import * as errors from '@lib/errors/gql';
import { convertTextToRichTextDocument } from '@lib/textManipulation/convertTextToRichTextDocument';
import { Environment } from '@lib/types/Environment';
import { HolaplexService } from '@src/holaplex/holaplex.service';
import { OnChainService } from '@src/on-chain/on-chain.service';

import { RealmProposalSort } from './dto/pagination';
import { RealmProposal } from './dto/RealmProposal';
import { RealmProposalState } from './dto/RealmProposalState';
import { RealmProposalUserVote, RealmProposalUserVoteType } from './dto/RealmProposalUserVote';
import * as queries from './holaplexQueries';

@Injectable()
export class RealmProposalService {
  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly holaplexService: HolaplexService,
    private readonly onChainService: OnChainService,
  ) {}

  /**
   * Get a single proposal
   */
  getProposalByPublicKey(proposalPublicKey: PublicKey, environment: Environment) {
    if (environment === 'devnet') {
      return TE.left(new errors.UnsupportedDevnet());
    }

    return FN.pipe(
      this.holaplexService.requestV1(
        {
          query: queries.realmProposal.query,
          variables: {
            proposal: proposalPublicKey.toBase58(),
          },
        },
        queries.realmProposal.resp,
      ),
      TE.map(({ proposals }) => proposals),
      TE.map(AR.head),
      TE.chainW(TE.fromOption(() => new errors.NotFound())),
      TE.bindTo('proposal'),
      TE.bindW('proposalVoteRecords', ({ proposal }) =>
        this.getVoteRecordsForHolaplexProposals([proposal], environment),
      ),
      TE.bindW('proposalMints', ({ proposal }) =>
        this.getGoverningTokenMintsForHolaplexProposals([proposal], environment),
      ),
      TE.chainW(({ proposal, proposalMints, proposalVoteRecords }) =>
        TE.tryCatch(
          () =>
            this.buildProposalFromHolaplexRespose(
              proposal,
              [],
              proposalVoteRecords[proposal.address] || [],
              proposalMints[proposal.address]?.account,
            ),
          (e) => new errors.Exception(e),
        ),
      ),
    );
  }

  /**
   * Get a single proposal
   */
  getProposalForUserByPublicKey(
    proposalPublicKey: PublicKey,
    requestingUser: PublicKey | null,
    environment: Environment,
  ) {
    if (environment === 'devnet') {
      return TE.left(new errors.UnsupportedDevnet());
    }

    return FN.pipe(
      this.holaplexService.requestV1(
        {
          query: queries.realmProposal.query,
          variables: {
            proposal: proposalPublicKey.toBase58(),
          },
        },
        queries.realmProposal.resp,
      ),
      TE.map(({ proposals }) => proposals),
      TE.map(AR.head),
      TE.chainW(TE.fromOption(() => new errors.NotFound())),
      TE.bindTo('proposal'),
      TE.bindW('proposalVoteRecords', ({ proposal }) =>
        this.getVoteRecordsForHolaplexProposals([proposal], environment),
      ),
      TE.bindW('proposalMints', ({ proposal }) =>
        this.getGoverningTokenMintsForHolaplexProposals([proposal], environment),
      ),
      TE.bindW('userVoteRecords', ({ proposal }) =>
        FN.pipe(
          requestingUser
            ? this.holaplexService.requestV1(
                {
                  query: queries.voteRecordsForUser.query,
                  variables: {
                    user: requestingUser.toBase58(),
                    proposals: [proposal.address],
                  },
                },
                queries.voteRecordsForUser.resp,
              )
            : TE.right({ voteRecords: [] }),
          TE.map(({ voteRecords }) => voteRecords),
        ),
      ),
      TE.chainW(({ proposal, proposalMints, proposalVoteRecords, userVoteRecords }) =>
        TE.tryCatch(
          () =>
            this.buildProposalFromHolaplexRespose(
              proposal,
              userVoteRecords,
              proposalVoteRecords[proposal.address] || [],
              proposalMints[proposal.address]?.account,
            ),
          (e) => new errors.Exception(e),
        ),
      ),
    );
  }

  /**
   * Get a list of proposals in a realm
   */
  getProposalsForRealm(realmPublicKey: PublicKey, environment: Environment) {
    if (environment === 'devnet') {
      return TE.left(new errors.UnsupportedDevnet());
    }

    return FN.pipe(
      this.onChainService.getGovernancesForRealm(realmPublicKey, environment),
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
      TE.bindW('proposalVoteRecords', ({ proposals }) =>
        this.getVoteRecordsForHolaplexProposals(proposals, environment),
      ),
      TE.bindW('proposalMints', ({ proposals }) =>
        this.getGoverningTokenMintsForHolaplexProposals(proposals, environment),
      ),
      TE.chainW(({ proposals, proposalMints, proposalVoteRecords }) =>
        TE.sequenceArray(
          proposals.map((proposal) =>
            TE.tryCatch(
              () =>
                this.buildProposalFromHolaplexRespose(
                  proposal,
                  [],
                  proposalVoteRecords[proposal.address] || [],
                  proposalMints[proposal.address]?.account,
                ),
              (e) => new errors.Exception(e),
            ),
          ),
        ),
      ),
    );
  }

  /**
   * Fetch a list of proposals in a Realm using user context and sort them
   */
  getProposalsForRealmAndUser(
    realmPublicKey: PublicKey,
    requestingUser: PublicKey | null,
    sortOrder: RealmProposalSort,
    environment: Environment,
  ) {
    if (environment === 'devnet') {
      return TE.left(new errors.UnsupportedDevnet());
    }

    return FN.pipe(
      this.onChainService.getGovernancesForRealm(realmPublicKey, environment),
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
      TE.bindW('proposalVoteRecords', ({ proposals }) =>
        this.getVoteRecordsForHolaplexProposals(proposals, environment),
      ),
      TE.bindW('proposalMints', ({ proposals }) =>
        this.getGoverningTokenMintsForHolaplexProposals(proposals, environment),
      ),
      TE.bindW('userVoteRecords', ({ proposals }) =>
        FN.pipe(
          requestingUser
            ? this.holaplexService.requestV1(
                {
                  query: queries.voteRecordsForUser.query,
                  variables: {
                    user: requestingUser.toBase58(),
                    proposals: proposals.map((p) => p.address),
                  },
                },
                queries.voteRecordsForUser.resp,
              )
            : TE.right({ voteRecords: [] }),
          TE.map(({ voteRecords }) => voteRecords),
        ),
      ),
      TE.chainW(({ proposals, proposalMints, proposalVoteRecords, userVoteRecords }) =>
        TE.sequenceArray(
          proposals.map((proposal) =>
            TE.tryCatch(
              () =>
                this.buildProposalFromHolaplexRespose(
                  proposal,
                  userVoteRecords,
                  proposalVoteRecords[proposal.address] || [],
                  proposalMints[proposal.address]?.account,
                ),
              (e) => new errors.Exception(e),
            ),
          ),
        ),
      ),
      TE.map((proposals) => {
        switch (sortOrder) {
          case RealmProposalSort.Alphabetical:
            return proposals.slice().sort(this.sortAlphabetically);
          case RealmProposalSort.Relevance:
            return proposals.slice().sort(this.sortRelevance);
          default:
            return proposals.slice().sort(this.sortTime);
        }
      }),
    );
  }

  /**
   * Get proposals by public keys
   */
  getProposalsForRealmAndUserByPublicKeys(
    realmPublicKey: PublicKey,
    publicKeys: PublicKey[],
    requestingUser: PublicKey | null,
    environment: Environment,
  ) {
    if (environment === 'devnet') {
      return TE.left(new errors.UnsupportedDevnet());
    }

    return FN.pipe(
      this.getProposalsForRealmAndUser(
        realmPublicKey,
        requestingUser,
        RealmProposalSort.Alphabetical,
        environment,
      ),
      TE.map(
        AR.reduce({} as { [publicKeyStr: string]: RealmProposal }, (acc, proposal) => {
          for (const key of publicKeys) {
            if (key.equals(proposal.publicKey)) {
              acc[key.toBase58()] = proposal;
            }
          }

          return acc;
        }),
      ),
    );
  }

  /**
   * Get a list of governing token mints for proposals
   */
  getGoverningTokenMintsForHolaplexProposals(
    proposals: IT.TypeOf<typeof queries.realmProposals.respProposal>[],
    environment: Environment,
  ) {
    if (environment === 'devnet') {
      return TE.left(new errors.UnsupportedDevnet());
    }

    return FN.pipe(
      TE.sequenceArray(
        proposals.map((proposal) =>
          FN.pipe(
            this.onChainService.getTokenMintInfo(
              new PublicKey(proposal.governingTokenMint),
              environment,
            ),
            TE.map((mint) => ({ [proposal.address]: mint })),
          ),
        ),
      ),
      TE.map((mints) =>
        mints.reduce((acc, mint) => {
          return { ...acc, ...mint };
        }, {} as { [address: string]: { publicKey: PublicKey; account: MintInfo } }),
      ),
    );
  }

  /**
   * Get all the vote records for proposals
   */
  getVoteRecordsForHolaplexProposals(
    proposals: IT.TypeOf<typeof queries.realmProposals.respProposal>[],
    environment: Environment,
  ) {
    if (environment === 'devnet') {
      return TE.left(new errors.UnsupportedDevnet());
    }

    const cacheableProposals = proposals.filter((proposal) => proposal.state !== 'VOTING');
    const notCacheable = proposals.filter((proposal) => proposal.state === 'VOTING');
    const missing: IT.TypeOf<typeof queries.realmProposals.respProposal>[] = [];
    const result: {
      [key: string]: IT.TypeOf<typeof queries.voteRecordsForProposal.respVoteRecord>[];
    } = {};

    return FN.pipe(
      TE.sequenceArray(
        cacheableProposals.map((proposal) =>
          FN.pipe(
            TE.tryCatch(
              () =>
                this.cacheManager.get<
                  IT.TypeOf<typeof queries.voteRecordsForProposal.respVoteRecord>[]
                >(`vote-records-${proposal.address}`),
              (e) => new errors.Exception(e),
            ),
            TE.matchW(
              () => {
                missing.push(proposal);
                return TE.right(false);
              },
              (records) => {
                if (records) {
                  result[proposal.address] = records;
                  return TE.right(false);
                } else {
                  missing.push(proposal);
                  return TE.right(true);
                }
              },
            ),
            TE.fromTask,
            TE.flatten,
          ),
        ),
      ),
      TE.chainW(() => TE.right(missing.concat(notCacheable))),
      TE.chainW((proposals) =>
        this.holaplexService.requestV1(
          {
            query: queries.voteRecordsForProposal.query,
            variables: {
              proposals: proposals.map((proposal) => proposal.address),
            },
          },
          queries.voteRecordsForProposal.resp,
        ),
      ),
      TE.map(({ voteRecords }) => {
        const mapping: {
          [key: string]: IT.TypeOf<typeof queries.voteRecordsForProposal.respVoteRecord>[];
        } = {};

        for (const voteRecord of voteRecords) {
          if (!mapping[voteRecord.proposal.address]) {
            mapping[voteRecord.proposal.address] = [];
          }

          mapping[voteRecord.proposal.address].push(voteRecord);
        }

        return mapping;
      }),
      TE.map((mapping) => {
        for (const proposal of missing) {
          const records = mapping[proposal.address];

          if (records) {
            result[proposal.address] = records;
            this.cacheManager.set(`vote-records-${proposal.address}`, records, {
              ttl: 60 * 60 * 24 * 5,
            });
          }
        }

        for (const proposal of notCacheable) {
          const records = mapping[proposal.address];

          if (records) {
            result[proposal.address] = records;
          }
        }
      }),
      TE.map(() => result),
    );
  }

  /**
   * Convert a Holaplex proposal to a GQL proposal
   */
  private buildProposalFromHolaplexRespose = async (
    holaplexProposal: IT.TypeOf<typeof queries.realmProposals.respProposal>,
    userVoteRecords: IT.TypeOf<typeof queries.voteRecordsForUser.respVoteRecord>[],
    proposalVoteRecords: IT.TypeOf<typeof queries.voteRecordsForProposal.respVoteRecord>[],
    mint?: MintInfo,
  ) => {
    return {
      author: holaplexProposal.tokenOwnerRecord
        ? {
            publicKey: new PublicKey(holaplexProposal.tokenOwnerRecord.address),
          }
        : undefined,
      created: new Date(holaplexProposal.draftAt),
      document: await convertTextToRichTextDocument(holaplexProposal.description),
      description: holaplexProposal.description,
      publicKey: new PublicKey(holaplexProposal.address),
      myVote: this.buildProposalUserVote(userVoteRecords, holaplexProposal.address),
      state: this.buildProposalStateFromHolaplexResponse(holaplexProposal),
      title: holaplexProposal.name,
      updated: this.buildPropsalUpdatedFromHolaplexResponse(holaplexProposal),
      voteBreakdown: this.buildVotingBreakdownFromHolaplexResponse(
        holaplexProposal,
        proposalVoteRecords,
        mint,
      ),
    };
  };

  /**
   * Get the vote state for a proposal from an Holaplex response
   */
  private buildProposalStateFromHolaplexResponse = (
    holaplexProposal: IT.TypeOf<typeof queries.realmProposals.respProposal>,
  ) => {
    let hasInstructions = false;
    let votingEnded = false;

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

      if (timeToVoteEnd <= 0) {
        votingEnded = true;
      }
    }

    if (holaplexProposal.proposalOptions && holaplexProposal.proposalOptions.length) {
      for (const option of holaplexProposal.proposalOptions) {
        if (option.transactionsCount > 0) {
          hasInstructions = true;
          break;
        }
      }
    }

    if (holaplexProposal.instructionsCount && holaplexProposal.instructionsCount > 0) {
      hasInstructions = true;
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
    voteRecords: IT.TypeOf<typeof queries.voteRecordsForUser.respVoteRecord>[],
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
        case 'YES': {
          type = RealmProposalUserVoteType.Yes;
          break;
        }
        case 'NO': {
          type = RealmProposalUserVoteType.No;
          break;
        }
      }

      if (type) {
        const weight = record.voteWeight
          ? new BigNumber(record.voteWeight)
          : record.voterWeight
          ? new BigNumber(record.voterWeight)
          : new BigNumber(0);

        return { type, weight };
      }
    }

    return null;
  };

  /**
   * Get a breakdown of the vote result
   */
  buildVotingBreakdownFromHolaplexResponse(
    holaplexProposal: IT.TypeOf<typeof queries.realmProposals.respProposal>,
    proposalVoteRecords: IT.TypeOf<typeof queries.voteRecordsForProposal.respVoteRecord>[],
    mint?: MintInfo,
  ) {
    const decimals = mint?.decimals || 0;
    let totalYesWeight = new BigNumber(0);
    let totalNoWeight = new BigNumber(0);

    for (const voteRecord of proposalVoteRecords) {
      if (voteRecord.voteType === 'YES' && voteRecord.voteWeight) {
        totalYesWeight = totalYesWeight.plus(new BigNumber(voteRecord.voteWeight));
      } else if (voteRecord.voteType === 'NO' && voteRecord.voteWeight) {
        totalNoWeight = totalNoWeight.plus(new BigNumber(voteRecord.voteWeight));
      } else if (voteRecord.vote === 'APPROVE' && voteRecord.voterWeight) {
        totalYesWeight = totalYesWeight.plus(new BigNumber(voteRecord.voterWeight));
      } else if (voteRecord.vote === 'DENY' && voteRecord.voterWeight) {
        totalNoWeight = totalNoWeight.plus(new BigNumber(voteRecord.voterWeight));
      }
    }

    return {
      percentThresholdMet: null,
      threshold: null,
      totalNoWeight: totalNoWeight.shiftedBy(-decimals),
      totalYesWeight: totalYesWeight.shiftedBy(-decimals),
    };
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
