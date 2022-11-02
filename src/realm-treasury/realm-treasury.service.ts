import { CACHE_MANAGER, Injectable, Inject } from '@nestjs/common';
import { TokenListProvider, TokenInfo } from '@solana/spl-token-registry';
import { PublicKey } from '@solana/web3.js';
import { BigNumber } from 'bignumber.js';
import { Cache } from 'cache-manager';
import * as FN from 'fp-ts/function';
import * as OP from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import { mergeDeepRight } from 'ramda';

import * as errors from '@lib/errors/gql';
import { Environment } from '@lib/types/Environment';
import { ConfigService } from '@src/config/config.service';
import { OnChainService } from '@src/on-chain/on-chain.service';

const PRICE_ENDPOINT = 'https://price.jup.ag/v1/price';

interface TokenOverrides {
  [mintAddress: string]: Partial<TokenInfo>;
}

@Injectable()
export class RealmTreasuryService {
  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly configService: ConfigService,
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
      TE.tryCatch(
        () =>
          Promise.all([
            this.onChainService.getTokenAccountsInRealm(realmPublicKey, environment),
            this.onChainService.getAuxiliaryTokenAccountsInRealm(realmPublicKey, environment),
          ]),
        (e) => new errors.Exception(e),
      ),
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
              TE.map((price) => {
                return new BigNumber(account.account.amount.toString())
                  .shiftedBy(-account.mintInfo.account.decimals)
                  .times(price);
              }),
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
              TE.map((tokenInfo) => (OP.isNone(tokenInfo) ? undefined : tokenInfo.value.symbol)),
              TE.chainW((symbol) =>
                symbol
                  ? FN.pipe(
                      TE.tryCatch(
                        () =>
                          fetch(`${PRICE_ENDPOINT}?id=${symbol}`).then<{
                            data: {
                              id: string;
                              price: number;
                            };
                          }>((resp) => resp.json()),
                        (e) => new errors.Exception(e),
                      ),
                      TE.map((resp) => resp?.data?.price || 0),
                      TE.chain((price) =>
                        TE.tryCatch(
                          () => this.cacheManager.set(cacheKey, price, 60 * 5),
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
              TE.bindTo('tokenListContainer'),
              TE.bindW('overrides', () => this.fetchTokenOverrides(environment)),
              TE.map(({ tokenListContainer, overrides }) =>
                tokenListContainer
                  .filterByClusterSlug('mainnet-beta')
                  .getList()
                  .map((tokenInfo) => {
                    if (overrides[tokenInfo.address]) {
                      return mergeDeepRight(tokenInfo, overrides[tokenInfo.address]) as TokenInfo;
                    }

                    return tokenInfo;
                  }),
              ),
              TE.chainW((tokenList) =>
                TE.tryCatch(
                  () => this.cacheManager.set(cacheKey, tokenList, 60 * 10),
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

  /**
   * Get manual overrides for token info
   */
  fetchTokenOverrides(environment: Environment) {
    const cacheKey = `realm-token-overrides-${environment}`;

    return FN.pipe(
      TE.tryCatch(
        () => this.cacheManager.get<TokenOverrides>(cacheKey),
        (e) => new errors.Exception(e),
      ),
      TE.map(OP.fromNullable),
      TE.chainW((overrides) =>
        OP.isSome(overrides)
          ? TE.right(overrides.value)
          : FN.pipe(
              TE.tryCatch(
                () =>
                  fetch(
                    `${this.configService.get(
                      'app.codeCommitedInfoUrl',
                    )}/realms/token-overrides.json`,
                  ).then<TokenOverrides>((response) => response.json()),
                (e) => new errors.Exception(e),
              ),
              TE.chain((overrides) =>
                TE.tryCatch(
                  () => this.cacheManager.set(cacheKey, overrides, 60 * 10),
                  (e) => new errors.Exception(e),
                ),
              ),
            ),
      ),
    );
  }
}
