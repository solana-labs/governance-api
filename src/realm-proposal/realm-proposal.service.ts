import { CACHE_MANAGER, Injectable, Inject } from '@nestjs/common';
import {
  Governance as RawGovernance,
  Proposal,
  ProposalState,
  VoteRecord,
  YesNoVote,
  ProgramAccount,
  Realm,
  MintMaxVoteWeightSourceType,
} from '@solana/spl-governance';
import { MintInfo } from '@solana/spl-token';
import { PublicKey } from '@solana/web3.js';
import BigNumber from 'bignumber.js';
import { Cache } from 'cache-manager';
import { compareDesc } from 'date-fns';

import { convertTextToRichTextDocument } from '@lib/textManipulation/convertTextToRichTextDocument';
import { Environment } from '@lib/types/Environment';
import { HeliusService } from '@src/helius/helius.service';
import { RealmGovernanceService } from '@src/realm-governance/realm-governance.service';
import { RealmMemberService } from '@src/realm-member/realm-member.service';
import { StaleCacheService } from '@src/stale-cache/stale-cache.service';

import { RealmProposalSort } from './dto/pagination';
import { RealmProposal } from './dto/RealmProposal';
import { RealmProposalState } from './dto/RealmProposalState';
import { RealmProposalUserVote, RealmProposalUserVoteType } from './dto/RealmProposalUserVote';

@Injectable()
export class RealmProposalService {
  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly heliusService: HeliusService,
    private readonly realmGovernanceService: RealmGovernanceService,
    private readonly realmMemberService: RealmMemberService,
    private readonly staleCacheService: StaleCacheService,
  ) {}

  /**
   * Get a single proposal
   */
  async getProposalByPublicKey(proposalPublicKey: PublicKey, environment: Environment) {
    const proposal = await this.heliusService.getProposal(proposalPublicKey, environment);
    const governance = await this.heliusService.getGovernance(
      proposal.account.governance,
      environment,
    );
    const [programId, realm, mint] = await Promise.all([
      this.heliusService.getProgramId(governance.account.realm, environment),
      this.heliusService.getRealm(governance.account.realm, environment),
      this.heliusService.getTokenMintInfo(proposal.account.governingTokenMint, environment),
    ]);

    const proposalVotes = await this.heliusService.getVoteRecordsByProposal(
      proposalPublicKey,
      programId,
      environment,
    );

    const realmProposal: RealmProposal = {
      author: {
        publicKey: proposal.account.tokenOwnerRecord,
      },
      created: new Date(proposal.account.draftAt.toNumber()),
      document: await convertTextToRichTextDocument(proposal.account.descriptionLink),
      description: proposal.account.descriptionLink,
      publicKey: proposal.pubkey,
      myVote: null,
      state: this.buildProposalState(proposal.account, governance.account),
      title: proposal.account.name,
      updated: this.buildPropsalUpdated(proposal.account),
      voteBreakdown: this.buildVotingBreakdown(
        proposal,
        proposalVotes,
        governance.account,
        realm,
        mint?.account,
      ),
    };

    return realmProposal;
  }

  /**
   * Get a single proposal
   */
  async getProposalForUserByPublicKey(
    proposalPublicKey: PublicKey,
    requestingUser: PublicKey | null,
    environment: Environment,
  ) {
    const proposal = await this.heliusService.getProposal(proposalPublicKey, environment);
    const governance = await this.heliusService.getGovernance(
      proposal.account.governance,
      environment,
    );
    const [programId, realm, mint] = await Promise.all([
      this.heliusService.getProgramId(governance.account.realm, environment),
      this.heliusService.getRealm(governance.account.realm, environment),
      this.heliusService.getTokenMintInfo(proposal.account.governingTokenMint, environment),
    ]);

    const [proposalVotes, userVotes] = await Promise.all([
      this.heliusService.getVoteRecordsByProposal(proposalPublicKey, programId, environment),
      requestingUser
        ? this.heliusService.getVoteRecordsByVoter(programId, requestingUser, environment)
        : [],
    ]);

    const realmProposal: RealmProposal = {
      author: {
        publicKey: proposal.account.tokenOwnerRecord,
      },
      created: new Date(proposal.account.draftAt.toNumber()),
      document: await convertTextToRichTextDocument(proposal.account.descriptionLink),
      description: proposal.account.descriptionLink,
      publicKey: proposal.pubkey,
      myVote: this.buildProposalUserVote(
        userVotes.map((v) => v.account),
        proposal.pubkey.toBase58(),
      ),
      state: this.buildProposalState(proposal.account, governance.account),
      title: proposal.account.name,
      updated: this.buildPropsalUpdated(proposal.account),
      voteBreakdown: this.buildVotingBreakdown(
        proposal,
        proposalVotes,
        governance.account,
        realm,
        mint?.account,
      ),
    };

    return realmProposal;
  }

  /**
   * Get a list of proposals in a realm
   */
  async getProposalsForRealm(realmPublicKey: PublicKey, environment: Environment) {
    const [rawProposals, programId, realm] = await Promise.all([
      this.heliusService.getAllProposalsForRealm(realmPublicKey, environment),
      this.heliusService.getProgramId(realmPublicKey, environment),
      this.heliusService.getRealm(realmPublicKey, environment),
    ]);

    const [councilMint, communityMint] = await Promise.all([
      realm.account.config.councilMint
        ? this.heliusService.getTokenMintInfo(realm.account.config.councilMint, environment)
        : null,
      this.heliusService.getTokenMintInfo(realm.account.communityMint, environment),
    ]);

    const unsorted = await Promise.all(
      rawProposals.map(async (proposal) => {
        const mintInfo =
          realm.account.config.councilMint &&
          proposal.account.governingTokenMint.equals(realm.account.config.councilMint)
            ? councilMint
            : communityMint;

        const [governance, proposalVoteRecords] = await Promise.all([
          this.heliusService.getGovernance(proposal.account.governance, environment),
          this.heliusService.getVoteRecordsByProposal(proposal.pubkey, programId, environment),
        ]);

        const realmProposal: RealmProposal = {
          author: {
            publicKey: proposal.account.tokenOwnerRecord,
          },
          created: new Date(proposal.account.draftAt.toNumber()),
          document: await convertTextToRichTextDocument(proposal.account.descriptionLink),
          description: proposal.account.descriptionLink,
          publicKey: proposal.pubkey,
          myVote: null,
          state: this.buildProposalState(proposal.account, governance.account),
          title: proposal.account.name,
          updated: this.buildPropsalUpdated(proposal.account),
          voteBreakdown: this.buildVotingBreakdown(
            proposal,
            proposalVoteRecords,
            governance.account,
            realm,
            mintInfo?.account,
          ),
        };

        return realmProposal;
      }),
    );

    return unsorted;
  }

  /**
   * Get a list of proposal addresses
   */
  async getProposalAddressesForRealm(realmPublicKey: PublicKey, environment: Environment) {
    const proposals = await this.getProposalsForRealmAndUser(
      realmPublicKey,
      null,
      RealmProposalSort.Time,
      environment,
    );
    return proposals.map((p) => ({
      publicKey: p.publicKey,
      updated: p.updated,
    }));
  }

  /**
   * Fetch a list of proposals in a Realm using user context and sort them
   */
  async getProposalsForRealmAndUser(
    realmPublicKey: PublicKey,
    requestingUser: PublicKey | null,
    sortOrder: RealmProposalSort,
    environment: Environment,
  ) {
    const [rawProposals, programId, realm] = await Promise.all([
      this.heliusService.getAllProposalsForRealm(realmPublicKey, environment),
      this.heliusService.getProgramId(realmPublicKey, environment),
      this.heliusService.getRealm(realmPublicKey, environment),
    ]);

    const voteRecords = requestingUser
      ? await this.heliusService.getVoteRecordsByVoter(programId, requestingUser, environment)
      : [];

    const [councilMint, communityMint] = await Promise.all([
      realm.account.config.councilMint
        ? this.heliusService.getTokenMintInfo(realm.account.config.councilMint, environment)
        : null,
      this.heliusService.getTokenMintInfo(realm.account.communityMint, environment),
    ]);

    const unsorted = await Promise.all(
      rawProposals.map(async (proposal) => {
        const mintInfo =
          realm.account.config.councilMint &&
          proposal.account.governingTokenMint.equals(realm.account.config.councilMint)
            ? councilMint
            : communityMint;

        const [governance, proposalVoteRecords] = await Promise.all([
          this.heliusService.getGovernance(proposal.account.governance, environment),
          this.heliusService.getVoteRecordsByProposal(proposal.pubkey, programId, environment),
        ]);

        const realmProposal: RealmProposal = {
          author: {
            publicKey: proposal.account.tokenOwnerRecord,
          },
          created: new Date(proposal.account.draftAt.toNumber()),
          document: await convertTextToRichTextDocument(proposal.account.descriptionLink),
          description: proposal.account.descriptionLink,
          publicKey: proposal.pubkey,
          myVote: this.buildProposalUserVote(
            voteRecords.map((vr) => vr.account),
            proposal.pubkey.toBase58(),
          ),
          state: this.buildProposalState(proposal.account, governance.account),
          title: proposal.account.name,
          updated: this.buildPropsalUpdated(proposal.account),
          voteBreakdown: this.buildVotingBreakdown(
            proposal,
            proposalVoteRecords,
            governance.account,
            realm,
            mintInfo?.account,
          ),
        };

        return realmProposal;
      }),
    );

    switch (sortOrder) {
      case RealmProposalSort.Alphabetical:
        return unsorted.slice().sort(this.sortAlphabetically);
      case RealmProposalSort.Relevance:
        return unsorted.slice().sort(this.sortRelevance);
      default:
        return unsorted.slice().sort(this.sortTime);
    }
  }

  /**
   * Get proposals by public keys
   */
  async getProposalsForRealmAndUserByPublicKeys(
    realmPublicKey: PublicKey,
    publicKeys: PublicKey[],
    requestingUser: PublicKey | null,
    environment: Environment,
  ) {
    const proposals = await this.getProposalsForRealmAndUser(
      realmPublicKey,
      requestingUser,
      RealmProposalSort.Alphabetical,
      environment,
    );

    return proposals.reduce((acc, proposal) => {
      for (const key of publicKeys) {
        if (key.equals(proposal.publicKey)) {
          acc[key.toBase58()] = proposal;
        }
      }

      return acc;
    }, {} as { [publicKeyStr: string]: RealmProposal });
  }

  /**
   * Get a list of governing token mints for proposals
   */
  async getGoverningTokenMintsForHolaplexProposals(
    proposals: ProgramAccount<Proposal>[],
    environment: Environment,
  ) {
    const mints = new Set<string>([]);
    for (const proposal of proposals) {
      mints.add(proposal.account.governingTokenMint.toBase58());
    }
    const mintPks = Array.from(mints).map((address) => new PublicKey(address));
    const mintInfos = await Promise.all(
      mintPks.map((mint) => this.heliusService.getTokenMintInfo(mint, environment)),
    );
    const mintMapping = mintInfos.reduce((acc, mint) => {
      acc[mint.publicKey.toBase58()] = mint;
      return acc;
    }, {} as { [address: string]: { publicKey: PublicKey; account: MintInfo } });
    return proposals.reduce((acc, proposal) => {
      acc[proposal.pubkey.toBase58()] = mintMapping[proposal.account.governingTokenMint.toBase58()];
      return acc;
    }, {} as { [address: string]: { publicKey: PublicKey; account: MintInfo } });
  }

  /**
   * Get the vote state for a proposal from an Holaplex response
   */
  private buildProposalState = (proposal: Proposal, governance: RawGovernance) => {
    let hasInstructions = false;
    let votingEnded = false;

    if (governance.config.maxVotingTime && proposal.state === ProposalState.Voting) {
      const nowUnixSeconds = Date.now() / 1000;
      const votingAt = proposal.votingAt
        ? new Date(proposal.votingAt.toNumber()).getTime() / 1000
        : 0;
      const maxVotingTime = governance.config.maxVotingTime;
      const timeToVoteEnd = votingAt + maxVotingTime - nowUnixSeconds;

      if (timeToVoteEnd <= 0) {
        votingEnded = true;
      }
    }

    if (proposal.options && proposal.options.length) {
      for (const option of proposal.options) {
        if (option.instructionsCount > 0) {
          hasInstructions = true;
          break;
        }
      }
    }

    if (proposal.instructionsCount && proposal.instructionsCount > 0) {
      hasInstructions = true;
    }

    switch (proposal.state) {
      case ProposalState.Cancelled:
        return RealmProposalState.Cancelled;
      case ProposalState.Completed:
        return RealmProposalState.Completed;
      case ProposalState.Defeated:
        return RealmProposalState.Defeated;
      case ProposalState.Draft:
        return RealmProposalState.Draft;
      case ProposalState.Executing:
        return RealmProposalState.Executable;
      case ProposalState.ExecutingWithErrors:
        return RealmProposalState.ExecutingWithErrors;
      case ProposalState.SigningOff:
        return RealmProposalState.SigningOff;
      case ProposalState.Succeeded:
        return !hasInstructions ? RealmProposalState.Completed : RealmProposalState.Executable;
      default:
        return votingEnded ? RealmProposalState.Finalizing : RealmProposalState.Voting;
    }
  };

  /**
   * Get a timestamp of when the proposal was last updated
   */
  private buildPropsalUpdated = (
    proposal: Pick<
      Proposal,
      | 'closedAt'
      | 'executingAt'
      | 'votingCompletedAt'
      | 'votingAt'
      | 'startVotingAt'
      | 'signingOffAt'
      | 'draftAt'
    >,
  ) => {
    if (proposal.closedAt) {
      return new Date(proposal.closedAt.toNumber());
    } else if (proposal.executingAt) {
      return new Date(proposal.executingAt.toNumber());
    } else if (proposal.votingCompletedAt) {
      return new Date(proposal.votingCompletedAt.toNumber());
    } else if (proposal.votingAt) {
      return new Date(proposal.votingAt.toNumber());
    } else if (proposal.startVotingAt) {
      return new Date(proposal.startVotingAt.toNumber());
    } else if (proposal.signingOffAt) {
      return new Date(proposal.signingOffAt.toNumber());
    } else {
      return new Date(proposal.draftAt.toNumber());
    }
  };

  /** Get the user vote for a proposal */
  private buildProposalUserVote = (
    voteRecords: VoteRecord[],
    proposalAddress: string,
  ): RealmProposalUserVote | null => {
    const record = voteRecords.find((record) => record.proposal.toBase58() === proposalAddress);

    if (record) {
      let type: RealmProposalUserVoteType | null = null;
      let weight = new BigNumber(0);

      if (record.vote?.veto) {
        type = RealmProposalUserVoteType.Veto;

        if (record.voteWeight) {
          weight = new BigNumber(record.voteWeight.no.toString());
        }
      } else if (record.vote?.toYesNoVote() === YesNoVote.Yes) {
        type = RealmProposalUserVoteType.Yes;

        if (record.voteWeight) {
          weight = new BigNumber(record.voteWeight.yes.toString());
        }
      } else if (record.vote?.toYesNoVote() === YesNoVote.No) {
        type = RealmProposalUserVoteType.No;

        if (record.voteWeight) {
          weight = new BigNumber(record.voteWeight.no.toString());
        }
      } else {
        type = RealmProposalUserVoteType.Abstain;
      }

      return { type, weight };
    }

    return null;
  };

  /**
   * Get a breakdown of the vote result
   */
  buildVotingBreakdown(
    proposal: ProgramAccount<Proposal>,
    proposalVoteRecords: ProgramAccount<VoteRecord>[],
    governance: RawGovernance,
    realm: ProgramAccount<Realm>,
    mint?: MintInfo,
  ) {
    const decimals = mint?.decimals || 0;
    let percentThresholdMet: number | null = null;
    let threshold: BigNumber | null = null;
    let totalNoWeight = new BigNumber(0);
    let totalYesWeight = new BigNumber(0);
    let votingEndTime: number | null = null;
    let voteThresholdPercentage = 100;

    let totalPossibleWeight: BigNumber | null = new BigNumber(0);

    if (proposal.account.noVotesCount && proposal.account.yesVotesCount) {
      totalYesWeight = new BigNumber(proposal.account.yesVotesCount.toString());
      totalNoWeight = new BigNumber(proposal.account.noVotesCount.toString());
    } else if (proposal.account.denyVoteWeight && proposal.account.options?.length) {
      totalYesWeight = new BigNumber(proposal.account.options[0].voteWeight.toString());
      totalNoWeight = new BigNumber(proposal.account.denyVoteWeight.toString());
    } else {
      for (const voteRecord of proposalVoteRecords) {
        if (
          voteRecord.account.vote?.toYesNoVote() === YesNoVote.Yes &&
          voteRecord.account.voteWeight?.yes
        ) {
          totalYesWeight = totalYesWeight.plus(
            new BigNumber(voteRecord.account.voteWeight.yes.toString()),
          );
        } else if (
          voteRecord.account.vote?.toYesNoVote() === YesNoVote.No &&
          voteRecord.account.voteWeight?.no
        ) {
          totalNoWeight = totalNoWeight.plus(
            new BigNumber(voteRecord.account.voteWeight.no.toString()),
          );
        }
      }
    }

    if (governance.config.maxVotingTime) {
      const maxVotingTime = governance.config.maxVotingTime;
      const maxVotingTimeInMs = maxVotingTime * 1000;

      if (proposal.account.votingAt) {
        const start = new Date(proposal.account.votingAt.toNumber());
        votingEndTime = start.getTime() + maxVotingTimeInMs;
      }
    }

    if (
      governance?.config &&
      realm.account.communityMint.equals(proposal.account.governingTokenMint) &&
      totalPossibleWeight &&
      mint
    ) {
      totalPossibleWeight = realm.account.config.communityMintMaxVoteWeightSource.isFullSupply()
        ? new BigNumber(mint.supply.toString())
        : realm.account.config.communityMintMaxVoteWeightSource.type ===
          MintMaxVoteWeightSourceType.Absolute
        ? new BigNumber(realm.account.config.communityMintMaxVoteWeightSource.value.toString())
        : new BigNumber(
            realm.account.config.communityMintMaxVoteWeightSource.fmtSupplyFractionPercentage(),
          )
            .multipliedBy(new BigNumber(mint.supply.toString()))
            .dividedBy(100);
    }

    if (totalPossibleWeight.isGreaterThan(0)) {
      voteThresholdPercentage =
        (realm.account.config.councilMint &&
        proposal.account.governingTokenMint.equals(realm.account.config.councilMint)
          ? governance.config.councilVoteThreshold.value
          : governance.config.communityVoteThreshold.value) || 100;

      threshold = totalPossibleWeight.multipliedBy(voteThresholdPercentage / 100);
      percentThresholdMet = totalYesWeight.isGreaterThanOrEqualTo(threshold)
        ? 100
        : totalYesWeight.dividedBy(threshold).multipliedBy(100).toNumber();
    }

    return {
      percentThresholdMet,
      voteThresholdPercentage,
      threshold: threshold?.shiftedBy(-decimals),
      totalNoWeight: totalNoWeight.shiftedBy(-decimals),
      totalPossibleWeight: totalPossibleWeight?.shiftedBy(-decimals) || null,
      totalYesWeight: totalYesWeight.shiftedBy(-decimals),
      votingEnd: votingEndTime ? new Date(votingEndTime) : null,
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
