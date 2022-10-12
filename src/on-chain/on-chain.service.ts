import { CACHE_MANAGER, Injectable, Inject } from '@nestjs/common';
import {
  getGovernanceAccounts,
  Governance,
  pubkeyFilter,
  MemcmpFilter,
  getNativeTreasuryAddress,
} from '@solana/spl-governance';
import { AccountInfo, MintInfo, u64 } from '@solana/spl-token';
import { Connection, PublicKey } from '@solana/web3.js';
import { Cache } from 'cache-manager';
import { hoursToMilliseconds } from 'date-fns';
import * as EI from 'fp-ts/Either';

import * as errors from '@lib/errors/gql';
import { AUXILIARY_TOKEN_ASSETS } from '@lib/treasuryAssets/AUXILIARY_TOKEN_ASSETS';
import { getRawAssetAccounts } from '@lib/treasuryAssets/getRawAssetAccounts';
import { getSolAccounts } from '@lib/treasuryAssets/getSolAccounts';
import { parseMintAccountData } from '@lib/treasuryAssets/parseMintAccountData';
import { parseTokenAccountData } from '@lib/treasuryAssets/parseTokenAccountData';
import { exists } from '@lib/typeGuards/exists';
import { Environment } from '@lib/types/Environment';
import { RealmGovernanceService } from '@src/realm-governance/realm-governance.service';
import { RealmSettingsService } from '@src/realm-settings/realm-settings.service';
import { StaleCacheService } from '@src/stale-cache/stale-cache.service';

const SOL_MINT_PK = new PublicKey('So11111111111111111111111111111111111111112');
const DEFAULT_NFT_TREASURY_MINT = 'GNFTm5rz1Kzvq94G7DJkcrEUnCypeQYf7Ya8arPoHWvw';
// const DEFAULT_NATIVE_SOL_MINT = 'GSoLvSToqaUmMyqP12GffzcirPAickrpZmVUFtek6x5u';

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

const ENDPOINT =
  'http://realms-realms-c335.mainnet.rpcpool.com/258d3727-bb96-409d-abea-0b1b4c48af29/';

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
export class OnChainService {
  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly realmGovernanceService: RealmGovernanceService,
    private readonly realmSettingsService: RealmSettingsService,
    private readonly staleCacheService: StaleCacheService,
  ) {}

  /**
   * Convert raw token assets
   */
  async convertRawTokenAssets(
    assets: RawTokenAsset[],
    assetOwners: AssetOwner[],
    environment: Environment,
  ) {
    if (environment === 'devnet') {
      throw new errors.UnsupportedDevnet();
    }

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

  /**
   * Get a list of public keys that could potentially hold asset accounts
   */
  getAssetOwnersInRealm = this.staleCacheService.dedupe(
    async (realmPublicKey: PublicKey, environment: Environment) => {
      if (environment === 'devnet') {
        throw new errors.UnsupportedDevnet();
      }

      const settings = await this.realmSettingsService.getCodeCommittedSettingsForRealm(
        realmPublicKey,
        environment,
      );

      const governancesResp = await this.realmGovernanceService.getGovernancesForRealm(
        realmPublicKey,
        environment,
      )();

      if (EI.isLeft(governancesResp)) {
        throw governancesResp.left;
      }

      const governances = governancesResp.right;
      const owners = await Promise.all(
        governances.map((governance) =>
          getNativeTreasuryAddress(new PublicKey(settings.programId), governance.address).then(
            (wallet) => ({ wallet, governance: governance.address }),
          ),
        ),
      );
      return owners;
    },
    {
      dedupeKey: (pk, env) => pk.toBase58() + env,
      maxStaleAgeMs: hoursToMilliseconds(1),
    },
  );

  /**
   * Get token mint info
   */
  getTokenMintInfo = this.staleCacheService.dedupe(
    async (mintPublicKey: PublicKey, environment: Environment) => {
      if (environment === 'devnet') {
        throw new errors.UnsupportedDevnet();
      }

      const {
        result: { value },
      } = await this.getOnChainTokenMintInfo(mintPublicKey);
      const publicKey = mintPublicKey;
      const data = Buffer.from(value.data[0], 'base64');
      const account = parseMintAccountData(data);
      return { publicKey, account };
    },
    {
      dedupeKey: (pk, env) => pk.toBase58() + env,
      maxStaleAgeMs: hoursToMilliseconds(2),
    },
  );

  /**
   * Get a list of all the assets in a realm
   */
  getTokenAccountsInRealm = this.staleCacheService.dedupe(
    async (realmPublicKey: PublicKey, environment: Environment) => {
      if (environment === 'devnet') {
        throw new errors.UnsupportedDevnet();
      }

      const assetOwners = await this.getAssetOwnersInRealm(realmPublicKey, environment);
      const solAccounts = await getSolAccounts(assetOwners.map((owner) => owner.wallet));
      const tokenAccountsResp = await this.getAssets(
        assetOwners.map(({ governance, wallet }) => [governance, wallet]).flat(),
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
      dedupeKey: (pk, env) => pk.toBase58() + env,
      maxStaleAgeMs: hoursToMilliseconds(1),
    },
  );

  /**
   * Get a list of auxilliary token accounts in a realm
   */
  async getAuxiliaryTokenAccountsInRealm(realmPublicKey: PublicKey, environment: Environment) {
    if (environment === 'devnet') {
      throw new errors.UnsupportedDevnet();
    }

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
    const tokenAccountsResp = await this.getAssets(governances);
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
  }

  /**
   * Get a list of governances for a realm
   */
  getGovernancesForRealm = this.staleCacheService.dedupe(
    async (realmPublicKey: PublicKey, environment: Environment) => {
      if (environment === 'devnet') {
        throw new errors.UnsupportedDevnet();
      }

      const { programId } = await this.realmSettingsService.getCodeCommittedSettingsForRealm(
        realmPublicKey,
        environment,
      );

      const governances = await getGovernanceAccounts(
        new Connection(ENDPOINT),
        new PublicKey(programId),
        Governance,
        [pubkeyFilter(1, realmPublicKey) as MemcmpFilter],
      );

      return governances.map((governance) => ({
        address: governance.pubkey,
      }));
    },
    {
      dedupeKey: (pk, env) => pk.toBase58() + env,
      maxStaleAgeMs: hoursToMilliseconds(2),
    },
  );

  private getAssets = this.staleCacheService.dedupe(
    (pks: PublicKey[]) => {
      const connection = new Connection(ENDPOINT);
      return getRawAssetAccounts(pks, connection.commitment);
    },
    {
      dedupeKey: (pks) => pks.map((pk) => pk.toBase58()).join(''),
      maxStaleAgeMs: hoursToMilliseconds(1),
    },
  );

  private getOnChainTokenMintInfo = this.staleCacheService.dedupe(
    (mintPublicKey: PublicKey) => {
      const connection = new Connection(ENDPOINT);

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
      }).then<{
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
      });
    },
    {
      dedupeKey: (publicKey) => publicKey.toBase58(),
      maxStaleAgeMs: hoursToMilliseconds(12),
    },
  );
}
