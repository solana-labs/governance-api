import { Injectable } from '@nestjs/common';
import {
  getGovernance,
  getGovernanceAccounts,
  getGovernanceProgramVersion,
  getNativeTreasuryAddress,
  getProposal,
  getProposalsByGovernance,
  getRealm,
  getTokenOwnerRecord,
  getTokenOwnerRecordForRealm,
  getVoteRecordsByVoter,
  Governance,
  MemcmpFilter,
  pubkeyFilter,
  VoteRecord,
} from '@solana/spl-governance';
import { AccountInfo, MintInfo, u64 } from '@solana/spl-token';
import { Connection, PublicKey } from '@solana/web3.js';

import { AUXILIARY_TOKEN_ASSETS } from '@lib/treasuryAssets/AUXILIARY_TOKEN_ASSETS';
import { getRawAssetAccounts } from '@lib/treasuryAssets/getRawAssetAccounts';
import { getSolAccounts } from '@lib/treasuryAssets/getSolAccounts';
import { parseMintAccountData } from '@lib/treasuryAssets/parseMintAccountData';
import { parseTokenAccountData } from '@lib/treasuryAssets/parseTokenAccountData';
import { exists } from '@lib/typeGuards/exists';
import { Environment } from '@lib/types/Environment';
import { ConfigService } from '@src/config/config.service';
import { RealmSettingsService } from '@src/realm-settings/realm-settings.service';
import { StaleCacheService } from '@src/stale-cache/stale-cache.service';

const SOL_MINT_PK = new PublicKey('So11111111111111111111111111111111111111112');
const DEFAULT_NFT_TREASURY_MINT = 'GNFTm5rz1Kzvq94G7DJkcrEUnCypeQYf7Ya8arPoHWvw';

const SOL_MINT = {
  publicKey: SOL_MINT_PK,
  account: {
    mintAuthorityOption: 0,
    mintAuthority: null,
    supply: new u64(0),
    decimals: 9,
    isInitialized: true,
    freezeAuthorityOption: 0,
    freezeAuthority: null,
  },
};

function dedupeByPublicKey<T extends { publicKey: PublicKey }>(list: T[]) {
  const existing = new Set<string>();
  const dedupedByPublicKey: T[] = [];

  for (const item of list) {
    const address = item.publicKey.toBase58();

    if (!existing.has(address)) {
      existing.add(address);
      dedupedByPublicKey.push(item);
    }
  }

  return dedupedByPublicKey;
}

type RawTokenAsset = Awaited<ReturnType<typeof getRawAssetAccounts>>[number]['result'][number];

interface AssetOwner {
  governance: PublicKey;
  wallet: PublicKey;
}

interface Account {
  mintInfo: {
    publicKey: PublicKey;
    account: MintInfo;
  };
  publicKey: PublicKey;
  account: AccountInfo;
  governancePublicKey: PublicKey;
  walletPublicKey: PublicKey;
}

@Injectable()
export class HeliusService {
  constructor(
    private readonly configService: ConfigService,
    private readonly realmSettingsService: RealmSettingsService,
    private readonly staleCacheService: StaleCacheService,
  ) {}

  endpoint(environment: Environment) {
    switch (environment) {
      case 'devnet':
        return `https://rpc-devnet.helius.xyz/?api-key=${this.configService.get('helius.apiKey')}`;
      case 'mainnet':
        return `https://rpc.helius.xyz/?api-key=${this.configService.get('helius.apiKey')}`;
    }
  }

  connection(environment: Environment) {
    return new Connection(this.endpoint(environment));
  }

  getAssetOwnersInRealm = this.staleCacheService.dedupe(
    async (realmPublicKey: PublicKey, environment: Environment) => {
      const settings = await this.realmSettingsService.getCodeCommittedSettingsForRealm(
        realmPublicKey,
        environment,
      );

      const governances = await this.getGovernances(realmPublicKey, environment);

      const owners = await Promise.all(
        governances.map((governance) =>
          getNativeTreasuryAddress(new PublicKey(settings.programId), governance.pubkey).then(
            (wallet) => ({ wallet, governance: governance.pubkey }),
          ),
        ),
      );
      return owners;
    },
    {
      dedupeKey: (rpk, env) => rpk.toBase58() + env,
    },
  );

  getProgramId = this.staleCacheService.dedupe(
    async (realmPublicKey: PublicKey, environment: Environment) => {
      const { programId } = await this.realmSettingsService.getCodeCommittedSettingsForRealm(
        realmPublicKey,
        environment,
      );

      return new PublicKey(programId);
    },
    {
      dedupeKey: (rpk, env) => rpk.toBase58() + env,
    },
  );

  getProposal = this.staleCacheService.dedupe(
    (proposalPublicKey: PublicKey, environment: Environment) => {
      const connection = this.connection(environment);
      return getProposal(connection, proposalPublicKey);
    },
    {
      dedupeKey: (ppk, env) => ppk.toBase58() + env,
    },
  );

  getProposalsByGovernance = this.staleCacheService.dedupe(
    (programPublicKey: PublicKey, governancePublicKey: PublicKey, environment: Environment) => {
      const connection = this.connection(environment);
      return getProposalsByGovernance(connection, programPublicKey, governancePublicKey);
    },
    {
      dedupeKey: (ppk, gpk, env) => ppk.toBase58() + gpk.toBase58() + env,
    },
  );

  getAllProposalsForRealm = this.staleCacheService.dedupe(
    async (realmPublicKey: PublicKey, environment: Environment) => {
      const [governances, programId] = await Promise.all([
        this.getGovernances(realmPublicKey, environment),
        this.getProgramId(realmPublicKey, environment),
      ]);
      return Promise.all(
        governances.map((governance) =>
          this.getProposalsByGovernance(programId, governance.pubkey, environment),
        ),
      ).then((proposals) => proposals.flat());
    },
    {
      dedupeKey: (rpk, env) => rpk.toBase58() + env,
    },
  );

  getProgramVersion = this.staleCacheService.dedupe(
    (programPublicKey: PublicKey, environment: Environment) => {
      const connection = this.connection(environment);
      return getGovernanceProgramVersion(connection, programPublicKey);
    },
    {
      dedupeKey: (ppk, env) => ppk.toBase58() + env,
    },
  );

  getGovernances = this.staleCacheService.dedupe(
    async (realmPublicKey: PublicKey, environment: Environment) => {
      const connection = this.connection(environment);

      const programId = await this.getProgramId(realmPublicKey, environment);

      const governances = await getGovernanceAccounts(connection, programId, Governance, [
        pubkeyFilter(1, realmPublicKey) as MemcmpFilter,
      ]);

      return governances;
    },
    {
      dedupeKey: (rpk, env) => rpk.toBase58() + env,
    },
  );

  getGovernance = this.staleCacheService.dedupe(
    (governancePublicKey: PublicKey, environment: Environment) => {
      const connection = this.connection(environment);
      return getGovernance(connection, governancePublicKey);
    },
    {
      dedupeKey: (gpk, env) => gpk.toBase58() + env,
    },
  );

  getRealm = this.staleCacheService.dedupe(
    (realmPublicKey: PublicKey, environment: Environment) => {
      const connection = this.connection(environment);
      return getRealm(connection, realmPublicKey);
    },
    {
      dedupeKey: (rpk, env) => rpk.toBase58() + env,
    },
  );

  getAuxiliaryTokenAccountsInRealm = this.staleCacheService.dedupe(
    async (realmPublicKey: PublicKey, environment: Environment) => {
      const connection = this.connection(environment);

      const auxilliaryAccounts = AUXILIARY_TOKEN_ASSETS[realmPublicKey.toBase58()] || [];

      if (!auxilliaryAccounts.length) {
        return [];
      }

      const governances = auxilliaryAccounts.map((list) => list.owner);
      const accounts = auxilliaryAccounts.map((list) => list.accounts).flat();
      const { programId } = await this.realmSettingsService.getCodeCommittedSettingsForRealm(
        realmPublicKey,
        environment,
      );
      const assetOwners = await Promise.all(
        governances.map((governance) =>
          getNativeTreasuryAddress(new PublicKey(programId), governance).then((wallet) => ({
            wallet,
            governance,
          })),
        ),
      );
      const tokenAccountsResp = await getRawAssetAccounts(governances, connection.commitment);
      const tokenAccountsRaw = tokenAccountsResp.map(({ result }) => result).flat();
      const valid: RawTokenAsset[] = [];

      for (const asset of tokenAccountsRaw) {
        for (const account of accounts) {
          if (asset.pubkey === account.toBase58()) {
            valid.push(asset);
          }
        }
      }

      const tokenAssets = await this.convertRawTokenAssets(valid, assetOwners, environment);
      return tokenAssets;
    },
    {
      dedupeKey: (rpk, env) => rpk.toBase58() + env,
    },
  );

  getTokenAccountsInRealm = this.staleCacheService.dedupe(
    async (realmPublicKey: PublicKey, environment: Environment) => {
      const connection = this.connection(environment);

      const assetOwners = await this.getAssetOwnersInRealm(realmPublicKey, environment);
      const solAccounts = await getSolAccounts(assetOwners.map((owner) => owner.wallet));
      const tokenAccountsResp = await getRawAssetAccounts(
        assetOwners.map(({ governance, wallet }) => [governance, wallet]).flat(),
        connection.commitment,
      );
      const tokenAccountsRaw = tokenAccountsResp.map(({ result }) => result).flat();
      const tokenAccounts = await this.convertRawTokenAssets(
        tokenAccountsRaw,
        assetOwners,
        environment,
      );

      const lamportMap = solAccounts.reduce((cur, acc) => {
        cur[acc.owner.toBase58()] = acc.value?.lamports;
        return cur;
      }, {} as { [addr: string]: number | undefined });

      const unaccountedSolAccounts = new Set(Object.keys(lamportMap));

      const accounts = tokenAccounts
        .map((account) => {
          let amount = account.account.amount;

          if (account.account.isNative) {
            const wallet = account.walletPublicKey.toBase58();
            const solAmount = lamportMap[wallet];

            if (solAmount) {
              amount = new u64(solAmount);
              unaccountedSolAccounts.delete(wallet);
            }
          }

          return {
            ...account,
            account: {
              ...account.account,
              amount,
            },
          };
        })
        .filter((account) => {
          // ignore NFT accounts
          if (account.mintInfo.account.mintAuthority?.toBase58() === DEFAULT_NFT_TREASURY_MINT) {
            return false;
          }

          // ignore 1 supply tokens
          if (account.mintInfo.account.supply.cmpn(1) === 0) {
            return false;
          }

          return true;
        });

      const unaccounted: Account[] = [];

      if (unaccountedSolAccounts.size > 0) {
        for (const key of unaccountedSolAccounts.keys()) {
          const lamports = lamportMap[key];
          const owner = assetOwners.find(
            (owner) => owner.governance.toBase58() === key || owner.wallet.toBase58() === key,
          );

          if (lamports && owner) {
            unaccounted.push({
              account: {
                address: owner.wallet,
                mint: SOL_MINT.publicKey,
                owner: SOL_MINT_PK,
                amount: new u64(lamports),
                delegate: null,
                delegatedAmount: new u64(0),
                isInitialized: true,
                isFrozen: false,
                isNative: true,
                rentExemptReserve: new u64('2039280'),
                closeAuthority: null,
              },
              governancePublicKey: owner.governance,
              mintInfo: SOL_MINT,
              publicKey: owner.wallet,
              walletPublicKey: owner.wallet,
            });
          }
        }
      }

      return accounts.concat(unaccounted);
    },
    {
      dedupeKey: (rpk, env) => rpk.toBase58() + env,
    },
  );

  getTokenMintInfo = this.staleCacheService.dedupe(
    (mintPublicKey: PublicKey, environment: Environment) => {
      const connection = this.connection(environment);

      return fetch(connection.rpcEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: mintPublicKey.toBase58(),
          method: 'getAccountInfo',
          params: [
            mintPublicKey.toBase58(),
            {
              commitment: connection.commitment,
              encoding: 'base64',
            },
          ],
        }),
      })
        .then<{
          result: {
            context: {
              apiVersion: string;
              slot: number;
            };
            value: {
              data: any[];
              executable: boolean;
              lamports: number;
              owner: string;
              rentEpoch: number;
            };
          };
        }>((resp) => {
          return resp.json();
        })
        .then(({ result }) => {
          const { value } = result;
          const publicKey = mintPublicKey;
          const data = Buffer.from(value.data[0], 'base64');
          const account = parseMintAccountData(data);
          return { publicKey, account };
        });
    },
    {
      dedupeKey: (mpk, env) => mpk.toBase58() + env,
    },
  );

  getTokenOwnerRecord = this.staleCacheService.dedupe(
    (userPublicKey: PublicKey, environment: Environment) => {
      const connection = this.connection(environment);
      return getTokenOwnerRecord(connection, userPublicKey);
    },
    {
      dedupeKey: (upk, env) => upk.toBase58() + env,
    },
  );

  getTokenOwnerRecordForRealm = this.staleCacheService.dedupe(
    (
      programId: PublicKey,
      realm: PublicKey,
      governingTokenMint: PublicKey,
      governingTokenOwner: PublicKey,
      environment: Environment,
    ) => {
      const connection = this.connection(environment);
      return getTokenOwnerRecordForRealm(
        connection,
        programId,
        realm,
        governingTokenMint,
        governingTokenOwner,
      );
    },
    {
      dedupeKey: (pid, rpk, gtm, gto, env) =>
        pid.toBase58() + rpk.toBase58() + gtm.toBase58() + gto.toBase58() + env,
    },
  );

  getVoteRecordsByVoter = this.staleCacheService.dedupe(
    (programPublicKey: PublicKey, voterPublicKey: PublicKey, environment: Environment) => {
      const connection = this.connection(environment);
      return getVoteRecordsByVoter(connection, programPublicKey, voterPublicKey);
    },
    {
      dedupeKey: (ppk, vpk, env) => ppk.toBase58() + vpk.toBase58() + env,
    },
  );

  getVoteRecordsByProposal = this.staleCacheService.dedupe(
    async (proposalPublicKey: PublicKey, programId: PublicKey, environment: Environment) => {
      const connection = this.connection(environment);
      const filter = pubkeyFilter(1, proposalPublicKey);

      if (!filter) {
        return [];
      }

      return getGovernanceAccounts(connection, programId, VoteRecord, [filter]);
    },
    {
      dedupeKey: (ppk, pid, env) => ppk.toBase58() + pid.toBase58() + env,
    },
  );

  /**
   * Convert raw token assets
   */
  private async convertRawTokenAssets(
    assets: RawTokenAsset[],
    assetOwners: AssetOwner[],
    environment: Environment,
  ) {
    const converted = assets.map(({ account, pubkey }) => {
      const publicKey = new PublicKey(pubkey);
      const data = Buffer.from(account.data[0], 'base64');
      const parsedAccount = parseTokenAccountData(publicKey, data);

      const assetOwner = assetOwners.find(
        (assetOwner) =>
          assetOwner.governance.equals(parsedAccount.owner) ||
          assetOwner.wallet.equals(parsedAccount.owner),
      );

      if (!assetOwner) {
        return null;
      }

      return {
        publicKey,
        account: parsedAccount,
        governancePublicKey: assetOwner.governance,
        walletPublicKey: assetOwner.wallet,
      };
    });

    const filtered = converted.filter(exists);
    const deduped = dedupeByPublicKey(filtered);
    const withMints: Account[] = await Promise.all(
      deduped.map((account) =>
        this.getTokenMintInfo(account.account.mint, environment).then((mintInfo) => ({
          ...account,
          mintInfo,
        })),
      ),
    );

    return withMints;
  }
}
