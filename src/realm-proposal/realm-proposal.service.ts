import { CACHE_MANAGER, Injectable, Inject } from '@nestjs/common';
import { MintInfo } from '@solana/spl-token';
import { PublicKey } from '@solana/web3.js';
import BigNumber from 'bignumber.js';
import { Cache } from 'cache-manager';
import { compareDesc, hoursToMilliseconds } from 'date-fns';
import * as AR from 'fp-ts/Array';
import * as EI from 'fp-ts/Either';
import * as FN from 'fp-ts/function';
import * as TE from 'fp-ts/TaskEither';
import * as IT from 'io-ts';

import * as errors from '@lib/errors/gql';
import { convertTextToRichTextDocument } from '@lib/textManipulation/convertTextToRichTextDocument';
import { Environment } from '@lib/types/Environment';
import { HolaplexService } from '@src/holaplex/holaplex.service';
import { OnChainService } from '@src/on-chain/on-chain.service';
import { RealmGovernanceService, Governance } from '@src/realm-governance/realm-governance.service';
import { RealmMemberService } from '@src/realm-member/realm-member.service';
import { StaleCacheService } from '@src/stale-cache/stale-cache.service';

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
    private readonly realmGovernanceService: RealmGovernanceService,
    private readonly realmMemberService: RealmMemberService,
    private readonly staleCacheService: StaleCacheService,
  ) {}

  /**
   * Get a single proposal
   */
  getProposalByPublicKey(proposalPublicKey: PublicKey, environment: Environment) {
    if (environment === 'devnet') {
      return TE.left(new errors.UnsupportedDevnet());
    }

    return FN.pipe(
      TE.tryCatch(
        () => this.holaplexGetProposal(proposalPublicKey),
        (e) => new errors.Exception(e),
      ),
      TE.bindTo('proposal'),
      TE.bindW('proposalVoteRecords', ({ proposal }) =>
        this.getVoteRecordsForHolaplexProposals([proposal], environment),
      ),
      TE.bindW('proposalMints', ({ proposal }) =>
        this.getGoverningTokenMintsForHolaplexProposals([proposal], environment),
      ),
      TE.bindW('totalVoterPower', ({ proposal }) => {
        if (proposal.governance?.realm?.address) {
          return this.getTotalVoteWeightInRealm(
            new PublicKey(proposal.governance.realm.address),
            environment,
          );
        }

        return TE.right(undefined);
      }),
      TE.bindW('governances', ({ proposal }) => {
        if (proposal.governance?.address) {
          const governance: Governance = {
            address: new PublicKey(proposal.governance.address),
            communityMint: proposal.governance.realm?.communityMint
              ? new PublicKey(proposal.governance.realm.communityMint)
              : null,
            councilMint: proposal.governance.realm?.realmConfig?.councilMint
              ? new PublicKey(proposal.governance.realm.realmConfig.councilMint)
              : null,
            communityMintMaxVoteWeight: proposal.governance.realm?.realmConfig
              ?.communityMintMaxVoteWeight
              ? new BigNumber(proposal.governance.realm.realmConfig.communityMintMaxVoteWeight)
              : null,
            communityMintMaxVoteWeightSource:
              proposal.governance.realm?.realmConfig?.communityMintMaxVoteWeightSource || null,
          };

          return TE.right([governance]);
        }

        return TE.right([]);
      }),
      TE.chainW(({ governances, proposal, proposalMints, proposalVoteRecords, totalVoterPower }) =>
        TE.tryCatch(
          () =>
            this.buildProposalFromHolaplexRespose(
              proposal,
              [],
              proposalVoteRecords[proposal.address] || [],
              governances,
              proposalMints[proposal.address]?.account,
              totalVoterPower,
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
      TE.tryCatch(
        () => this.holaplexGetProposal(proposalPublicKey),
        (e) => new errors.Exception(e),
      ),
      TE.bindTo('proposal'),
      TE.bindW('proposalVoteRecords', ({ proposal }) =>
        this.getVoteRecordsForHolaplexProposals([proposal], environment),
      ),
      TE.bindW('proposalMints', ({ proposal }) =>
        this.getGoverningTokenMintsForHolaplexProposals([proposal], environment),
      ),
      TE.bindW('userVoteRecords', ({ proposal }) =>
        requestingUser
          ? TE.tryCatch(
              () =>
                this.holaplexGetVoteRecordsForUser(requestingUser, [
                  new PublicKey(proposal.address),
                ]),
              (e) => new errors.Exception(e),
            )
          : TE.right([]),
      ),
      TE.bindW('totalVoterPower', ({ proposal }) => {
        if (proposal.governance?.realm?.address) {
          return this.getTotalVoteWeightInRealm(
            new PublicKey(proposal.governance.realm.address),
            environment,
          );
        }

        return TE.right(undefined);
      }),
      TE.bindW('governances', ({ proposal }) => {
        if (proposal.governance?.address) {
          const governance: Governance = {
            address: new PublicKey(proposal.governance.address),
            communityMint: proposal.governance.realm?.communityMint
              ? new PublicKey(proposal.governance.realm.communityMint)
              : null,
            councilMint: proposal.governance.realm?.realmConfig?.councilMint
              ? new PublicKey(proposal.governance.realm.realmConfig.councilMint)
              : null,
            communityMintMaxVoteWeight: proposal.governance.realm?.realmConfig
              ?.communityMintMaxVoteWeight
              ? new BigNumber(proposal.governance.realm.realmConfig.communityMintMaxVoteWeight)
              : null,
            communityMintMaxVoteWeightSource:
              proposal.governance.realm?.realmConfig?.communityMintMaxVoteWeightSource || null,
          };

          return TE.right([governance]);
        }

        return TE.right([]);
      }),
      TE.chainW(
        ({
          governances,
          proposal,
          proposalMints,
          proposalVoteRecords,
          totalVoterPower,
          userVoteRecords,
        }) =>
          TE.tryCatch(
            () =>
              this.buildProposalFromHolaplexRespose(
                proposal,
                userVoteRecords,
                proposalVoteRecords[proposal.address] || [],
                governances,
                proposalMints[proposal.address]?.account,
                totalVoterPower,
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
      this.realmGovernanceService.getGovernancesForRealm(realmPublicKey, environment),
      TE.bindTo('governances'),
      TE.bindW('proposals', ({ governances }) =>
        TE.tryCatch(
          () => this.holaplexGetProposals(governances.map((g) => g.address)),
          (e) => new errors.Exception(e),
        ),
      ),
      TE.bindW('proposalVoteRecords', ({ proposals }) =>
        this.getVoteRecordsForHolaplexProposals(proposals, environment),
      ),
      TE.bindW('proposalMints', ({ proposals }) =>
        this.getGoverningTokenMintsForHolaplexProposals(proposals, environment),
      ),
      TE.bindW('totalVoterPower', () =>
        this.getTotalVoteWeightInRealm(realmPublicKey, environment),
      ),
      TE.chainW(({ governances, proposals, proposalMints, proposalVoteRecords, totalVoterPower }) =>
        TE.sequenceArray(
          proposals.map((proposal) =>
            TE.tryCatch(
              () =>
                this.buildProposalFromHolaplexRespose(
                  proposal,
                  [],
                  proposalVoteRecords[proposal.address] || [],
                  governances,
                  proposalMints[proposal.address]?.account,
                  totalVoterPower,
                ),
              (e) => new errors.Exception(e),
            ),
          ),
        ),
      ),
    );
  }

  /**
   * Get a list of proposal addresses
   */
  getProposalAddressesForRealm(realmPublicKey: PublicKey, environment: Environment) {
    if (environment === 'devnet') {
      return TE.left(new errors.UnsupportedDevnet());
    }

    return FN.pipe(
      this.realmGovernanceService.getGovernancesForRealm(realmPublicKey, environment),
      TE.chainW((governances) =>
        TE.tryCatch(
          () => this.holaplexGetProposals(governances.map((g) => g.address)),
          (e) => new errors.Exception(e),
        ),
      ),
      TE.map((proposals) =>
        proposals.map((p) => ({
          publicKey: new PublicKey(p.address),
          updated: this.buildPropsalUpdatedFromHolaplexResponse(p),
        })),
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
      this.realmGovernanceService.getGovernancesForRealm(realmPublicKey, environment),
      TE.bindTo('governances'),
      TE.bindW('proposals', ({ governances }) =>
        TE.tryCatch(
          () => this.holaplexGetProposals(governances.map((g) => g.address)),
          (e) => new errors.Exception(e),
        ),
      ),
      TE.bindW('proposalVoteRecords', ({ proposals }) =>
        this.getVoteRecordsForHolaplexProposals(proposals, environment),
      ),
      TE.bindW('proposalMints', ({ proposals }) =>
        this.getGoverningTokenMintsForHolaplexProposals(proposals, environment),
      ),
      TE.bindW('userVoteRecords', ({ proposals }) =>
        requestingUser
          ? TE.tryCatch(
              () =>
                this.holaplexGetVoteRecordsForUser(
                  requestingUser,
                  proposals.map((p) => new PublicKey(p.address)),
                ),
              (e) => new errors.Exception(e),
            )
          : TE.right([]),
      ),
      TE.bindW('totalVoterPower', () =>
        this.getTotalVoteWeightInRealm(realmPublicKey, environment),
      ),
      TE.chainW(
        ({
          governances,
          proposals,
          proposalMints,
          proposalVoteRecords,
          userVoteRecords,
          totalVoterPower,
        }) =>
          TE.sequenceArray(
            proposals.map((proposal) =>
              TE.tryCatch(
                () =>
                  this.buildProposalFromHolaplexRespose(
                    proposal,
                    userVoteRecords,
                    proposalVoteRecords[proposal.address] || [],
                    governances,
                    proposalMints[proposal.address]?.account,
                    totalVoterPower,
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

    const mints = new Set<string>([]);
    for (const proposal of proposals) {
      mints.add(proposal.governingTokenMint);
    }
    const mintPks = Array.from(mints).map((address) => new PublicKey(address));

    return FN.pipe(
      TE.sequenceArray(
        mintPks.map((mint) =>
          FN.pipe(
            TE.tryCatch(
              () => this.onChainService.getTokenMintInfo(mint, environment),
              (e) => new errors.Exception(e),
            ),
            TE.map((mintInfo) => ({ [mint.toBase58()]: mintInfo })),
          ),
        ),
      ),
      TE.map((mints) =>
        mints.reduce((acc, mint) => {
          return { ...acc, ...mint };
        }, {} as { [address: string]: { publicKey: PublicKey; account: MintInfo } }),
      ),
      TE.map((mintMapping) =>
        proposals.reduce((acc, proposal) => {
          acc[proposal.address] = mintMapping[proposal.governingTokenMint];
          return acc;
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
        TE.tryCatch(
          () => this.holaplexGetVoteRecords(proposals.map((p) => new PublicKey(p.address))),
          (e) => new errors.Exception(e),
        ),
      ),
      TE.map((voteRecords) => {
        const mapping: {
          [key: string]: IT.TypeOf<typeof queries.voteRecordsForProposal.respVoteRecord>[];
        } = {};

        for (const voteRecord of voteRecords) {
          if (voteRecord.proposal) {
            if (!mapping[voteRecord.proposal.address]) {
              mapping[voteRecord.proposal.address] = [];
            }

            mapping[voteRecord.proposal.address].push(voteRecord);
          }
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
    governances: Governance[],
    mint?: MintInfo,
    totalVoterPower?: BigNumber,
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
        totalVoterPower,
        governances.find(
          (governance) => governance.address.toBase58() === holaplexProposal.governance?.address,
        ),
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
    holaplexProposal: Pick<
      IT.TypeOf<typeof queries.realmProposals.respProposal>,
      | 'closedAt'
      | 'executingAt'
      | 'votingCompletedAt'
      | 'votingAt'
      | 'startVotingAt'
      | 'signingOffAt'
      | 'draftAt'
    >,
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
    const record = voteRecords.find((record) => record.proposal?.address === proposalAddress);

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
    totalVoterPower?: BigNumber,
    governance?: Governance,
  ) {
    const FULL_SUPPLY = new BigNumber(10000000000);
    const decimals = mint?.decimals || 0;
    let percentThresholdMet: number | null = null;
    let threshold: BigNumber | null = null;
    let totalNoWeight = new BigNumber(0);
    let totalYesWeight = new BigNumber(0);
    let votingEndTime: number | null = null;

    let totalPossibleWeight: BigNumber | null = holaplexProposal.maxVoteWeight
      ? new BigNumber(holaplexProposal.maxVoteWeight)
      : totalVoterPower || null;

    if (holaplexProposal.noVotesCount && holaplexProposal.yesVotesCount) {
      totalYesWeight = new BigNumber(holaplexProposal.yesVotesCount);
      totalNoWeight = new BigNumber(holaplexProposal.noVotesCount);
    } else if (holaplexProposal.denyVoteWeight && holaplexProposal.proposalOptions?.length) {
      totalYesWeight = new BigNumber(holaplexProposal.proposalOptions[0].voteWeight);
      totalNoWeight = new BigNumber(holaplexProposal.denyVoteWeight);
    } else {
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
    }

    if (holaplexProposal.governance?.governanceConfig?.maxVotingTime) {
      const maxVotingTime = parseInt(
        holaplexProposal.governance?.governanceConfig?.maxVotingTime,
        10,
      );
      const maxVotingTimeInMs = maxVotingTime * 1000;

      if (holaplexProposal.votingAt) {
        const start = new Date(holaplexProposal.votingAt);
        votingEndTime = start.getTime() + maxVotingTimeInMs;
      }
    }

    if (
      governance?.communityMintMaxVoteWeight &&
      governance.communityMint &&
      governance.communityMint.toBase58() === holaplexProposal.governingTokenMint &&
      totalPossibleWeight &&
      mint
    ) {
      const supply = governance.communityMintMaxVoteWeight;

      if (!supply.eq(FULL_SUPPLY)) {
        totalPossibleWeight = supply
          .multipliedBy(mint.supply.toString())
          .shiftedBy(-10)
          .decimalPlaces(0, BigNumber.ROUND_DOWN);
      }
    } else if (
      mint &&
      governance?.councilMint?.toBase58() === holaplexProposal.governingTokenMint
    ) {
      totalPossibleWeight = new BigNumber(mint.supply.toString());
    }

    if (
      holaplexProposal.governance?.governanceConfig?.voteThresholdPercentage &&
      totalPossibleWeight
    ) {
      const voteThresholdPercentage =
        holaplexProposal.governance.governanceConfig.voteThresholdPercentage;

      threshold = totalPossibleWeight.multipliedBy(voteThresholdPercentage / 100);
      percentThresholdMet = totalYesWeight.isGreaterThanOrEqualTo(threshold)
        ? 100
        : totalYesWeight.dividedBy(threshold).multipliedBy(100).toNumber();
    }

    return {
      percentThresholdMet,
      threshold: threshold?.shiftedBy(-decimals),
      totalNoWeight: totalNoWeight.shiftedBy(-decimals),
      totalPossibleWeight: totalPossibleWeight?.shiftedBy(-decimals) || null,
      totalYesWeight: totalYesWeight.shiftedBy(-decimals),
      voteThresholdPercentage:
        holaplexProposal.governance?.governanceConfig?.voteThresholdPercentage || null,
      votingEnd: votingEndTime ? new Date(votingEndTime) : null,
    };
  }

  /**
   * Get a proposal from holaplex
   */
  private holaplexGetProposal = this.staleCacheService.dedupe(
    async (proposalPublicKey: PublicKey) => {
      const resp = await this.holaplexService.requestV1(
        {
          query: queries.realmProposal.query,
          variables: {
            proposal: proposalPublicKey.toBase58(),
          },
        },
        queries.realmProposal.resp,
      )();

      if (EI.isLeft(resp)) {
        throw resp.left;
      }

      const { proposals } = resp.right;
      const proposal = proposals[0];

      if (!proposal) {
        throw new errors.NotFound();
      }

      return proposal;
    },
    {
      dedupeKey: (pk) => pk.toBase58(),
      maxStaleAgeMs: hoursToMilliseconds(1),
    },
  );

  /**
   * Get all the proposals belongs to a list of governances
   */
  private holaplexGetProposals = this.staleCacheService.dedupe(
    async (governances: PublicKey[]) => {
      const resp = await this.holaplexService.requestV1(
        {
          query: queries.realmProposals.query,
          variables: {
            governances: governances.map((g) => g.toBase58()),
          },
        },
        queries.realmProposals.resp,
      )();

      if (EI.isLeft(resp)) {
        throw resp.left;
      }

      return resp.right.proposals;
    },
    {
      dedupeKey: (governances) => governances.map((g) => g.toBase58()).join('-'),
      maxStaleAgeMs: hoursToMilliseconds(1),
    },
  );

  /**
   * Get all the vote records for a list of proposals
   */
  private holaplexGetVoteRecords = this.staleCacheService.dedupe(
    async (proposals: PublicKey[]) => {
      const resp = await this.holaplexService.requestV1(
        {
          query: queries.voteRecordsForProposal.query,
          variables: {
            proposals: proposals.map((proposal) => proposal.toBase58()),
          },
        },
        queries.voteRecordsForProposal.resp,
      )();

      if (EI.isLeft(resp)) {
        throw resp.left;
      }

      return resp.right.voteRecords;
    },
    {
      dedupeKey: (proposals) => proposals.map((p) => p.toBase58()).join('-'),
      maxStaleAgeMs: hoursToMilliseconds(1),
    },
  );

  /**
   * Get all the vote records for a user and proposal
   */
  private holaplexGetVoteRecordsForUser = this.staleCacheService.dedupe(
    async (user: PublicKey, proposals: PublicKey[]) => {
      const resp = await this.holaplexService.requestV1(
        {
          query: queries.voteRecordsForUser.query,
          variables: {
            user: user.toBase58(),
            proposals: proposals.map((p) => p.toBase58()),
          },
        },
        queries.voteRecordsForUser.resp,
      )();

      if (EI.isLeft(resp)) {
        throw resp.left;
      }

      return resp.right.voteRecords;
    },
    {
      dedupeKey: (user, proposals) => user.toBase58() + proposals.map((p) => p.toBase58()).join(''),
      maxStaleAgeMs: hoursToMilliseconds(6),
    },
  );

  /**
   * Get the total vote weight capacity in a Realm
   */
  private getTotalVoteWeightInRealm(realm: PublicKey, environment: Environment) {
    return FN.pipe(
      this.realmMemberService.getMembersForRealm(realm, environment),
      TE.map(AR.reduce(new BigNumber(0), (acc, cur) => acc.plus(cur.votingPower))),
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
