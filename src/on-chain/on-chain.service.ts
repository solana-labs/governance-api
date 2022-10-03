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
import * as AR from 'fp-ts/Array';
import * as FN from 'fp-ts/function';
import * as OP from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';

import * as errors from '@lib/errors/gql';
import { AUXILIARY_TOKEN_ASSETS } from '@lib/treasuryAssets/AUXILIARY_TOKEN_ASSETS';
import { getRawAssetAccounts } from '@lib/treasuryAssets/getRawAssetAccounts';
import { getSolAccounts } from '@lib/treasuryAssets/getSolAccounts';
import { parseMintAccountData } from '@lib/treasuryAssets/parseMintAccountData';
import { parseTokenAccountData } from '@lib/treasuryAssets/parseTokenAccountData';
import { exists } from '@lib/typeGuards/exists';
import { Environment } from '@lib/types/Environment';
import { dedupe } from '@src/lib/cacheAndDedupe';
import { RealmGovernanceService } from '@src/realm-governance/realm-governance.service';
import { RealmSettingsService } from '@src/realm-settings/realm-settings.service';

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

const getMintTokenInfo = dedupe(
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
    key: (publicKey) => publicKey.toBase58(),
  },
);

const getAssets = dedupe(
  (pks: PublicKey[]) => {
    const connection = new Connection(ENDPOINT);
    return getRawAssetAccounts(pks, connection.commitment);
  },
  {
    key: (pks) => pks.map((pk) => pk.toBase58()).join(''),
  },
);

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
  ) {}

  /**
   * Convert raw token assets
   */
  convertRawTokenAssets(
    assets: RawTokenAsset[],
    assetOwners: AssetOwner[],
    environment: Environment,
  ) {
    if (environment === 'devnet') {
      return TE.left(new errors.UnsupportedDevnet());
    }

    return FN.pipe(
      assets,
      AR.map(({ account, pubkey }) => {
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
      }),
      AR.filter(exists),
      dedupeByPublicKey,
      (accounts) =>
        TE.sequenceArray(
          accounts.map((account) =>
            FN.pipe(
              this.getTokenMintInfo(account.account.mint, environment),
              TE.map((mintInfo) => ({ ...account, mintInfo } as Account)),
            ),
          ),
        ),
    );
  }

  /**
   * Get a list of public keys that could potentially hold asset accounts
   */
  getAssetOwnersInRealm(realmPublicKey: PublicKey, environment: Environment) {
    if (environment === 'devnet') {
      return TE.left(new errors.UnsupportedDevnet());
    }

    return FN.pipe(
      this.realmSettingsService.getCodeCommittedSettingsForRealm(realmPublicKey, environment),
      TE.bindTo('settings'),
      TE.bind('governances', () =>
        this.realmGovernanceService.getGovernancesForRealm(realmPublicKey, environment),
      ),
      TE.chainW(({ governances, settings }) =>
        FN.pipe(
          TE.sequenceArray(
            governances.map((governance) =>
              TE.tryCatch(
                () =>
                  getNativeTreasuryAddress(
                    new PublicKey(settings.programId),
                    governance.address,
                  ).then((wallet) => ({ wallet, governance: governance.address })),
                (e) => new errors.Exception(e),
              ),
            ),
          ),
        ),
      ),
    );
  }

  /**
   * Get token mint info
   */
  getTokenMintInfo(mintPublicKey: PublicKey, environment: Environment) {
    if (environment === 'devnet') {
      return TE.left(new errors.UnsupportedDevnet());
    }

    const cacheKey = mintPublicKey.toBase58();

    return FN.pipe(
      TE.tryCatch(
        () =>
          this.cacheManager.get<{
            publicKey: PublicKey;
            account: MintInfo;
          }>(cacheKey),
        (e) => new errors.Exception(e),
      ),
      TE.map(OP.fromNullable),
      TE.chainW((cachedMint) =>
        OP.isSome(cachedMint)
          ? TE.right(cachedMint.value)
          : FN.pipe(
              TE.tryCatch(
                () => getMintTokenInfo(mintPublicKey),
                (e) => new errors.Exception(e),
              ),
              TE.map(({ result }) => {
                return result;
              }),
              TE.map(({ value }) => {
                const publicKey = mintPublicKey;
                const data = Buffer.from(value.data[0], 'base64');
                const account = parseMintAccountData(data);
                return { publicKey, account };
              }),
              TE.chainW((mintInfo) =>
                TE.tryCatch(
                  () => this.cacheManager.set(cacheKey, mintInfo, { ttl: 60 * 60 * 24 }),
                  (e) => new errors.Exception(e),
                ),
              ),
            ),
      ),
    );
  }

  /**
   * Get a list of all the assets in a realm
   */
  getTokenAccountsInRealm(realmPublicKey: PublicKey, environment: Environment) {
    if (environment === 'devnet') {
      return TE.left(new errors.UnsupportedDevnet());
    }

    return FN.pipe(
      this.getAssetOwnersInRealm(realmPublicKey, environment),
      TE.bindTo('assetOwners'),
      TE.bindW('solAccounts', ({ assetOwners }) =>
        FN.pipe(
          TE.tryCatch(
            () => getSolAccounts(assetOwners.map((owner) => owner.wallet)),
            (e) => new errors.Exception(e),
          ),
        ),
      ),
      TE.bindW('tokenAccounts', ({ assetOwners }) =>
        FN.pipe(
          TE.tryCatch(
            () =>
              getAssets(assetOwners.map(({ governance, wallet }) => [governance, wallet]).flat()),
            (e) => new errors.Exception(e),
          ),
          TE.map((results) => results.map(({ result }) => result).flat()),
          TE.chainW((rawAssets) =>
            this.convertRawTokenAssets(rawAssets, [...assetOwners], environment),
          ),
        ),
      ),
      TE.map(({ assetOwners, solAccounts, tokenAccounts }) => {
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
      }),
    );
  }

  /**
   * Get a list of auxilliary token accounts in a realm
   */
  getAuxiliaryTokenAccountsInRealm(realmPublicKey: PublicKey, environment: Environment) {
    if (environment === 'devnet') {
      return TE.left(new errors.UnsupportedDevnet());
    }

    const auxilliaryAccounts = AUXILIARY_TOKEN_ASSETS[realmPublicKey.toBase58()] || [];

    if (!auxilliaryAccounts.length) {
      return TE.right([]);
    }

    const governances = auxilliaryAccounts.map((list) => list.owner);
    const accounts = auxilliaryAccounts.map((list) => list.accounts).flat();

    return FN.pipe(
      this.realmSettingsService.getCodeCommittedSettingsForRealm(realmPublicKey, environment),
      TE.chainW(({ programId }) =>
        TE.sequenceArray(
          governances.map((governance) =>
            FN.pipe(
              TE.tryCatch(
                () => getNativeTreasuryAddress(new PublicKey(programId), governance),
                (e) => new errors.Exception(e),
              ),
              TE.map((wallet) => ({ governance, wallet })),
            ),
          ),
        ),
      ),
      TE.bindTo('assetOwners'),
      TE.bind('rawTokenAccounts', () =>
        FN.pipe(
          TE.tryCatch(
            () => getAssets(governances),
            (e) => new errors.Exception(e),
          ),
          TE.map((results) => results.map(({ result }) => result).flat()),
          TE.map((rawAssets) => {
            const valid: RawTokenAsset[] = [];

            for (const asset of rawAssets) {
              for (const account of accounts) {
                if (asset.pubkey === account.toBase58()) {
                  valid.push(asset);
                }
              }
            }

            return valid;
          }),
        ),
      ),
      TE.chainW(({ rawTokenAccounts, assetOwners }) =>
        this.convertRawTokenAssets(rawTokenAccounts, [...assetOwners], environment),
      ),
    );
  }

  /**
   * Get a list of governances for a realm
   */
  getGovernancesForRealm(realmPublicKey: PublicKey, environment: Environment) {
    if (environment === 'devnet') {
      return TE.left(new errors.UnsupportedDevnet());
    }

    return FN.pipe(
      this.realmSettingsService.getCodeCommittedSettingsForRealm(realmPublicKey, environment),
      TE.chainW(({ programId }) =>
        TE.tryCatch(
          () =>
            getGovernanceAccounts(new Connection(ENDPOINT), new PublicKey(programId), Governance, [
              pubkeyFilter(1, realmPublicKey) as MemcmpFilter,
            ]),
          (e) => new errors.Exception(e),
        ),
      ),
      TE.map(
        AR.map((governance) => ({
          address: governance.pubkey,
        })),
      ),
    );
  }
}
