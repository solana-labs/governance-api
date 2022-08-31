import { CACHE_MANAGER, Injectable, Inject } from '@nestjs/common';
import {
  getGovernanceAccounts,
  Governance,
  pubkeyFilter,
  MemcmpFilter,
  getNativeTreasuryAddress,
} from '@solana/spl-governance';
import { MintInfo } from '@solana/spl-token';
import { Connection, PublicKey } from '@solana/web3.js';
import { Cache } from 'cache-manager';
import * as AR from 'fp-ts/Array';
import * as FN from 'fp-ts/function';
import * as OP from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';

import * as errors from '@lib/errors/gql';
import { AUXILIARY_TOKEN_ASSETS } from '@lib/treasuryAssets/AUXILIARY_TOKEN_ASSETS';
import { getRawAssetAccounts } from '@lib/treasuryAssets/getRawAssetAccounts';
import { parseMintAccountData } from '@lib/treasuryAssets/parseMintAccountData';
import { parseTokenAccountData } from '@lib/treasuryAssets/parseTokenAccountData';
import { exists } from '@lib/typeGuards/exists';
import { Environment } from '@lib/types/Environment';
import { RealmSettingsService } from '@src/realm-settings/realm-settings.service';

function dedupe<T extends { publicKey: PublicKey }>(list: T[]) {
  const existing = new Set<string>();
  const deduped: T[] = [];

  for (const item of list) {
    const address = item.publicKey.toBase58();

    if (!existing.has(address)) {
      existing.add(address);
      deduped.push(item);
    }
  }

  return deduped;
}

type UnPromise<X> = X extends Promise<infer Y> ? Y : never;
type RawTokenAsset = UnPromise<ReturnType<typeof getRawAssetAccounts>>[number]['result'][number];

interface AssetOwner {
  governance: PublicKey;
  wallet: PublicKey;
}

@Injectable()
export class OnChainService {
  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
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
      dedupe,
      (accounts) =>
        TE.sequenceArray(
          accounts.map((account) =>
            FN.pipe(
              this.getTokenMintInfo(account.account.mint, environment),
              TE.map((mintInfo) => ({ ...account, mintInfo })),
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
      TE.bind('governances', () => this.getGovernancesForRealm(realmPublicKey, environment)),
      TE.chain(({ governances, settings }) =>
        FN.pipe(
          TE.sequenceArray(
            governances.map((governance) =>
              TE.tryCatch(
                () =>
                  getNativeTreasuryAddress(new PublicKey(settings.programId), governance).then(
                    (wallet) => ({ governance, wallet }),
                  ),
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

    const connection = new Connection('https://rpc.theindex.io');
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
                () =>
                  fetch(connection.rpcEndpoint, {
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
                  }>((resp) => resp.json()),
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

    const connection = new Connection('https://rpc.theindex.io');

    return FN.pipe(
      this.getAssetOwnersInRealm(realmPublicKey, environment),
      TE.chainW((assetOwners) =>
        FN.pipe(
          TE.tryCatch(
            () =>
              getRawAssetAccounts(
                assetOwners.map(({ governance, wallet }) => [governance, wallet]).flat(),
                connection.commitment,
              ),
            (e) => new errors.Exception(e),
          ),
          TE.map((results) => results.map(({ result }) => result).flat()),
          TE.chainW((rawAssets) =>
            this.convertRawTokenAssets(rawAssets, [...assetOwners], environment),
          ),
        ),
      ),
    );
  }

  /**
   * Get a list of auxilliary token accounts in a realm
   */
  getAuxiliaryTokenAccountsInRealm(realmPublicKey: PublicKey, environment: Environment) {
    if (environment === 'devnet') {
      return TE.left(new errors.UnsupportedDevnet());
    }

    const connection = new Connection('https://rpc.theindex.io');
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
            () => getRawAssetAccounts(governances, connection.commitment),
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
}
