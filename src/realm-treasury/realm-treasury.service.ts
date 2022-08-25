import { CACHE_MANAGER, Injectable, Inject } from '@nestjs/common';
import { TokenListProvider, TokenInfo } from '@solana/spl-token-registry';
import { PublicKey } from '@solana/web3.js';
import { BigNumber } from 'bignumber.js';
import { Cache } from 'cache-manager';
import * as FN from 'fp-ts/function';
import * as OP from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';

import * as errors from '@lib/errors/gql';
import { Environment } from '@lib/types/Environment';
import { OnChainService } from '@src/on-chain/on-chain.service';

const PRICE_ENDPOINT = 'https://api.coingecko.com/api/v3/simple/price';

@Injectable()
export class RealmTreasuryService {
  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly onChainService: OnChainService,
  ) {}

  /**
   * Get the total estimated value of assets in a realm's treasury
   */
  getRealmTreasuryValue(realmPublicKey: PublicKey, environment: Environment) {
    if (environment === 'devnet') {
      return TE.left(new errors.UnsupportedDevnet());
    }

    return FN.pipe(
      TE.sequenceArray([
        this.onChainService.getTokenAccountsInRealm(realmPublicKey, environment),
        this.onChainService.getAuxiliaryTokenAccountsInRealm(realmPublicKey, environment),
      ]),
      TE.map(([tokenAccounts, auxiliaryTokenAccounts]) => [
        ...tokenAccounts,
        ...auxiliaryTokenAccounts,
      ]),
      TE.chainW((accounts) =>
        TE.sequenceArray(
          accounts.map((account) =>
            FN.pipe(
              this.getTokenPrice(account.mintInfo.publicKey, environment),
              TE.match(
                () => TE.right(0),
                (price) => TE.right(price),
              ),
              TE.fromTask,
              TE.flatten,
              TE.map((price) =>
                new BigNumber(account.account.amount.toString())
                  .shiftedBy(-account.mintInfo.account.decimals)
                  .times(price),
              ),
            ),
          ),
        ),
      ),
      TE.map((values) => values.reduce((acc, value) => acc.plus(value), new BigNumber(0))),
    );
  }

  /**
   * Get the price of a token
   */
  getTokenPrice(tokenMint: PublicKey, environment: Environment) {
    const cacheKey = `token-price-${tokenMint.toBase58()}`;

    return FN.pipe(
      TE.tryCatch(
        () => this.cacheManager.get<number>(cacheKey),
        (e) => new errors.Exception(e),
      ),
      TE.map(OP.fromNullable),
      TE.chainW((price) =>
        OP.isSome(price)
          ? TE.right(price.value)
          : FN.pipe(
              this.fetchTokenListDict(environment),
              TE.map((tokenDict) => tokenDict[tokenMint.toBase58()]),
              TE.map(OP.fromNullable),
              TE.map((tokenInfo) =>
                OP.isNone(tokenInfo) ? undefined : tokenInfo.value.extensions?.coingeckoId,
              ),
              TE.chainW((coingeckoId) =>
                coingeckoId
                  ? FN.pipe(
                      TE.tryCatch(
                        () =>
                          fetch(`${PRICE_ENDPOINT}?ids=${coingeckoId}&vs_currencies=usd`).then<{
                            [id: string]: { usd: number };
                          }>((resp) => resp.json()),
                        (e) => new errors.Exception(e),
                      ),
                      TE.map((resp) => resp?.[coingeckoId]?.usd || 0),
                      TE.chain((price) =>
                        TE.tryCatch(
                          () => this.cacheManager.set(cacheKey, price, { ttl: 60 * 10 }),
                          (e) => new errors.Exception(e),
                        ),
                      ),
                    )
                  : TE.right(0),
              ),
            ),
      ),
    );
  }

  /**
   * Grabs a list of tokens from the token registry
   */
  fetchTokenList(environment: Environment) {
    if (environment === 'devnet') {
      return TE.left(new errors.UnsupportedDevnet());
    }

    const cacheKey = 'tokenList';

    return FN.pipe(
      TE.tryCatch(
        () => this.cacheManager.get<TokenInfo[]>(cacheKey),
        (e) => new errors.Exception(e),
      ),
      TE.map(OP.fromNullable),
      TE.chainW((cachedList) =>
        OP.isSome(cachedList)
          ? TE.right(cachedList.value)
          : FN.pipe(
              TE.tryCatch(
                () => new TokenListProvider().resolve(),
                (e) => new errors.Exception(e),
              ),
              TE.map((tokenListContainer) =>
                tokenListContainer.filterByClusterSlug('mainnet-beta').getList(),
              ),
              TE.chainW((tokenList) =>
                TE.tryCatch(
                  () => this.cacheManager.set(cacheKey, tokenList, { ttl: 60 }),
                  (e) => new errors.Exception(e),
                ),
              ),
            ),
      ),
    );
  }

  /**
   * Grabs a list of tokens and puts them in a dictionary
   */
  fetchTokenListDict(environment: Environment) {
    return FN.pipe(
      this.fetchTokenList(environment),
      TE.map((tokenList) =>
        tokenList.reduce((acc, token) => {
          acc[token.address] = token;
          return acc;
        }, {} as { [key: string]: TokenInfo }),
      ),
    );
  }
}