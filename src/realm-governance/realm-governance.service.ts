import { Injectable } from '@nestjs/common';
import { getNativeTreasuryAddress, VoteTipping, VoteThresholdType } from '@solana/spl-governance';
import { MintMaxVoteWeightSourceType } from '@solana/spl-governance';
import { PublicKey } from '@solana/web3.js';
import { BigNumber } from 'bignumber.js';
import { secondsToHours } from 'date-fns';

import * as errors from '@lib/errors/gql';
import { Environment } from '@lib/types/Environment';
import { HeliusService } from '@src/helius/helius.service';
import { StaleCacheService } from '@src/stale-cache/stale-cache.service';

import { GovernanceRules, GovernanceTokenType, GovernanceVoteTipping } from './dto/GovernanceRules';

const MAX_NUM = new BigNumber('18446744073709551615');

export interface Governance {
  address: PublicKey;
  communityMint: PublicKey | null;
  councilMint: PublicKey | null;
  communityMintMaxVoteWeight: BigNumber | null;
  communityMintMaxVoteWeightSource: MintMaxVoteWeightSourceType | null;
}

function voteTippingToGovernanceVoteTipping(voteTipping: VoteTipping | string) {
  switch (voteTipping) {
    case VoteTipping.Disabled:
      return GovernanceVoteTipping.Disabled;
    case VoteTipping.Early:
      return GovernanceVoteTipping.Early;
    case VoteTipping.Strict:
      return GovernanceVoteTipping.Strict;
    case 'DISABLED':
      return GovernanceVoteTipping.Disabled;
    case 'EARLY':
      return GovernanceVoteTipping.Early;
    case 'STRICT':
      return GovernanceVoteTipping.Strict;
    default:
      return GovernanceVoteTipping.Disabled;
  }
}

@Injectable()
export class RealmGovernanceService {
  constructor(
    private readonly staleCacheService: StaleCacheService,
    private readonly heliusService: HeliusService,
  ) {}

  /**
   * Get a list of governances for a realm
   */
  async getGovernancesForRealm(realmPublicKey: PublicKey, environment: Environment) {
    const [governances, realm] = await Promise.all([
      this.heliusService.getGovernances(realmPublicKey, environment),
      this.heliusService.getRealm(realmPublicKey, environment),
    ]);

    return governances.map((data) => {
      const governance: Governance = {
        address: data.pubkey,
        communityMint: realm.account.communityMint,
        councilMint: realm.account.config.councilMint || null,
        communityMintMaxVoteWeight: new BigNumber(
          realm.account.config.communityMintMaxVoteWeightSource.value.toString(),
        ),
        communityMintMaxVoteWeightSource:
          realm.account.config.communityMintMaxVoteWeightSource.type,
      };
      return governance;
    });
  }

  /**
   * Get the rules for a governance
   */
  async getGovernanceRules(
    programPublicKey: PublicKey,
    governanceAddress: PublicKey,
    environment: Environment,
  ) {
    const [walletAddress, programVersion, governanceAccount] = await Promise.all([
      getNativeTreasuryAddress(programPublicKey, governanceAddress),
      this.heliusService.getProgramVersion(programPublicKey, environment),
      this.heliusService.getGovernance(governanceAddress, environment),
    ]);

    const onChainConfig = governanceAccount.account.config;
    const realmPublicKey = governanceAccount.account.realm;

    const realm = await this.heliusService.getRealm(realmPublicKey, environment);

    const councilMint = realm.account.config.councilMint?.toBase58();
    const communityMint = realm.account.communityMint.toBase58();

    if (!communityMint) {
      throw new errors.MalformedData();
    }

    const [councilMintInfo, communityMintInfo] = await Promise.all([
      councilMint
        ? this.heliusService.getTokenMintInfo(new PublicKey(councilMint), environment)
        : null,
      this.heliusService.getTokenMintInfo(new PublicKey(communityMint), environment),
    ]);

    const rules: GovernanceRules = {
      governanceAddress,
      walletAddress,
      coolOffHours: secondsToHours(onChainConfig.votingCoolOffTime || 0),
      councilTokenRules: councilMintInfo
        ? {
            canCreateProposal: new BigNumber(
              onChainConfig.minCouncilTokensToCreateProposal.toString(),
            ).isLessThan(MAX_NUM),
            canVeto:
              onChainConfig.councilVetoVoteThreshold?.type ===
                VoteThresholdType.YesVotePercentage ||
              onChainConfig.councilVetoVoteThreshold?.type === VoteThresholdType.QuorumPercentage
                ? true
                : false,
            canVote:
              onChainConfig.councilVoteThreshold?.type === VoteThresholdType.Disabled
                ? false
                : true,
            quorumPercent: onChainConfig.councilVoteThreshold
              ? onChainConfig.councilVoteThreshold.type === VoteThresholdType.Disabled
                ? 60
                : onChainConfig.councilVoteThreshold.value || 60
              : 60,
            tokenMintAddress: councilMintInfo.publicKey,
            tokenMintDecimals: new BigNumber(councilMintInfo.account.decimals),
            tokenType: GovernanceTokenType.Council,
            totalSupply: new BigNumber(councilMintInfo.account.supply.toString()).shiftedBy(
              -councilMintInfo.account.decimals,
            ),
            vetoQuorumPercent: onChainConfig.councilVetoVoteThreshold
              ? onChainConfig.councilVetoVoteThreshold.type === VoteThresholdType.Disabled
                ? 60
                : onChainConfig.councilVetoVoteThreshold.value || 60
              : 60,
            voteTipping: voteTippingToGovernanceVoteTipping(onChainConfig.councilVoteTipping),
            votingPowerToCreateProposals: new BigNumber(
              onChainConfig.minCouncilTokensToCreateProposal.toString(),
            ).shiftedBy(-councilMintInfo.account.decimals),
          }
        : null,
      communityTokenRules: {
        canCreateProposal: new BigNumber(
          onChainConfig.minCommunityTokensToCreateProposal.toString(),
        ).isLessThan(MAX_NUM),
        canVeto:
          onChainConfig.communityVetoVoteThreshold?.type === VoteThresholdType.YesVotePercentage ||
          onChainConfig.communityVetoVoteThreshold?.type === VoteThresholdType.QuorumPercentage
            ? true
            : false,
        canVote:
          onChainConfig.communityVoteThreshold?.type === VoteThresholdType.Disabled ? false : true,
        quorumPercent: onChainConfig.communityVoteThreshold
          ? onChainConfig.communityVoteThreshold.type === VoteThresholdType.Disabled
            ? 60
            : onChainConfig.communityVoteThreshold.value || 60
          : 60,
        tokenMintAddress: communityMintInfo.publicKey,
        tokenMintDecimals: new BigNumber(communityMintInfo.account.decimals),
        tokenType: GovernanceTokenType.Community,
        totalSupply: new BigNumber(communityMintInfo.account.supply.toString()).shiftedBy(
          -communityMintInfo.account.decimals,
        ),
        vetoQuorumPercent: onChainConfig.communityVetoVoteThreshold
          ? onChainConfig.communityVetoVoteThreshold.type === VoteThresholdType.Disabled
            ? 60
            : onChainConfig.communityVetoVoteThreshold.value || 60
          : 60,
        voteTipping: voteTippingToGovernanceVoteTipping(onChainConfig.communityVoteTipping),
        votingPowerToCreateProposals: new BigNumber(
          onChainConfig.minCommunityTokensToCreateProposal.toString(),
        ).shiftedBy(-communityMintInfo.account.decimals),
      },
      depositExemptProposalCount: (onChainConfig as any)['depositExemptProposalCount'] || 10,
      maxVoteDays: secondsToHours(onChainConfig.maxVotingTime) / 24,
      minInstructionHoldupDays: secondsToHours(onChainConfig.minInstructionHoldUpTime) / 24,
      version: programVersion,
    };

    return rules;
  }
}
