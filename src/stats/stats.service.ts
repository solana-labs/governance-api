import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  getAllGovernances,
  Governance,
  ProgramAccount,
  getNativeTreasuryAddress,
} from '@solana/spl-governance';
import { PublicKey } from '@solana/web3.js';
import { BigNumber } from 'bignumber.js';
import { differenceInCalendarDays } from 'date-fns';
import { Repository } from 'typeorm';

import { batch } from '@lib/batch';
import { wait } from '@lib/wait';
import { HeliusService } from '@src/helius/helius.service';
import { Realm } from '@src/realm/entities/Realm.entity';

import { Tvl } from './entities/Tvl.entity';

const SOL_ADDR = 'So11111111111111111111111111111111111111112' as const;
const USDC_ADDR = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' as const;

const DEFAULT_TVL = {
  ownTokens: {},
  tvl: {
    [SOL_ADDR]: '0',
    [USDC_ADDR]: '0',
  },
};

export const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');

@Injectable()
export class StatsService {
  private readonly logger = new Logger(StatsService.name);

  constructor(
    private readonly heliusService: HeliusService,
    @InjectRepository(Realm)
    private readonly realmRepository: Repository<Realm>,
    @InjectRepository(Tvl)
    private readonly tvlRepository: Repository<Tvl>,
  ) {}

  async getTvl(force?: boolean) {
    if (force) {
      return this.getAndSaveTvl(force);
    }

    const cached = await this.tvlRepository.find({
      where: { pending: false },
      order: {
        updated: 'DESC',
      },
      take: 1,
    });

    if (cached.length > 0) {
      const item = cached[0];
      const result = item.data;

      if (Math.abs(differenceInCalendarDays(item.updated, Date.now())) > 1) {
        this.getAndSaveTvl(force);
      }

      return result;
    } else {
      this.getAndSaveTvl(force);
      return DEFAULT_TVL;
    }
  }

  async getAndSaveTvl(force?: boolean) {
    const pending = await this.tvlRepository.find({
      where: { pending: true },
    });

    if (force) {
      if (pending.length > 0) {
        this.tvlRepository.delete(pending.map((p) => p.id));
      }
    } else if (pending.length > 0) {
      return DEFAULT_TVL;
    }

    const newCached = this.tvlRepository.create({
      data: {
        ownTokens: {},
        tvl: {
          [SOL_ADDR]: '0',
          [USDC_ADDR]: '0',
        },
      },
      pending: true,
    });

    const [, result] = await Promise.all([this.tvlRepository.save(newCached), this.calculateTvl()]);

    const data: Tvl['data'] = {
      ownTokens: {},
      tvl: {},
    };

    for (const [type, amounts] of Object.entries(result)) {
      for (const [mint, amount] of Object.entries(amounts)) {
        data[type][mint] = amount.toString();
      }
    }

    const latestPending = await this.tvlRepository.findOne({
      where: { pending: true },
    });

    if (latestPending) {
      latestPending.data = data;
      latestPending.pending = false;
      await this.tvlRepository.save(latestPending);
    }

    return data;
  }

  async calculateTvl() {
    this.logger.verbose('Fetching a list of realms');
    const realms = await this.realmRepository.find({ where: { environment: 'mainnet' } });
    const tokens = new Set<string>([]);

    const totalTvl: {
      ownTokens: {
        [mintAddress: string]: BigNumber;
      };
      tvl: {
        So11111111111111111111111111111111111111112: BigNumber;
        EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: BigNumber;
      };
    } = {
      ownTokens: {},
      tvl: {
        [SOL_ADDR]: new BigNumber(0),
        [USDC_ADDR]: new BigNumber(0),
      },
    };

    this.logger.verbose('Fetching a list of governances per realm');
    const realmsWithGovernances = await this.fetchGovernances(realms);

    this.logger.verbose('Fetching a list of tokens in each governance');
    const batches = batch(realmsWithGovernances, 10);

    await Promise.all(
      batches.map(async (batch) => {
        for (const realm of batch) {
          const tokenLists = await this.fetchTokens(realm.realm, realm.governances);

          for (const [mint, amount] of Object.entries(tokenLists)) {
            tokens.add(mint);

            if (mint === SOL_ADDR || mint === USDC_ADDR) {
              totalTvl.tvl[mint] = totalTvl.tvl[mint].plus(amount);
            } else {
              if (!totalTvl.ownTokens[mint]) {
                totalTvl.ownTokens[mint] = new BigNumber(0);
              }

              totalTvl.ownTokens[mint] = totalTvl.ownTokens[mint].plus(amount);
            }
          }
        }
      }),
    );

    this.logger.verbose('Completed calculating TVL');
    return totalTvl;
  }

  async fetchGovernances(realms: Realm[]) {
    const connection = this.heliusService.connection('mainnet');
    const batches = batch(realms, 50);
    const realmsWithGovernances: {
      realm: Realm;
      name: string;
      governances: ProgramAccount<Governance>[];
    }[] = [];

    await batches.reduce((acc, realms) => {
      return acc
        .then(async () =>
          Promise.all(
            realms.map((realm) => {
              this.logger.verbose(`Fetching governances for ${realm.data.name}`);

              return (
                realm.data.programPublicKeyStr
                  ? getAllGovernances(
                      connection,
                      new PublicKey(realm.data.programPublicKeyStr),
                      new PublicKey(realm.publicKeyStr),
                    )
                  : Promise.resolve([])
              ).then((governances) => {
                realmsWithGovernances.push({
                  realm,
                  governances,
                  name: realm.data.name,
                });
              });
            }),
          ),
        )
        .then(() => wait(500));
    }, Promise.resolve(true));

    return realmsWithGovernances;
  }

  async fetchTokens(realm: Realm, governances: ProgramAccount<Governance>[]) {
    const connection = this.heliusService.connection('mainnet');

    const tokensList: {
      [mintAddr: string]: BigNumber;
    } = {};

    if (realm.data.programPublicKeyStr) {
      for (const governace of governances) {
        this.logger.verbose(
          `Fetching tokens in ${realm.data.name} / ${governace.pubkey.toBase58()}`,
        );

        const solWallet = await getNativeTreasuryAddress(
          new PublicKey(realm.data.programPublicKeyStr),
          governace.pubkey,
        );

        const [tokens, moreTokens] = await Promise.all([
          this.fetchTokenList(governace.pubkey),
          this.fetchTokenList(solWallet),
        ]);

        const solAccount = await connection.getAccountInfo(solWallet).catch(() => null);

        if (solAccount) {
          if (!tokensList[SOL_ADDR]) {
            tokensList[SOL_ADDR] = new BigNumber(0);
          }

          tokensList[SOL_ADDR] = tokensList[SOL_ADDR].plus(new BigNumber(solAccount.lamports));
        }

        const relevantTokens = tokens
          .concat(moreTokens)
          .map((tokenAccount) => {
            return {
              mint: new PublicKey(tokenAccount.account.data.parsed.info.mint),
              amount: new BigNumber(tokenAccount.account.data.parsed.info.tokenAmount.amount),
            };
          })
          .filter((ta) => ta.amount.isGreaterThan(0));

        for (const token of relevantTokens) {
          if (!tokensList[token.mint.toBase58()]) {
            tokensList[token.mint.toBase58()] = new BigNumber(0);
          }

          tokensList[token.mint.toBase58()] = tokensList[token.mint.toBase58()].plus(token.amount);
        }
      }
    }

    return tokensList;
  }

  async fetchTokenList(governance: PublicKey) {
    const connection = this.heliusService.connection('mainnet');
    const resp = await connection
      .getParsedTokenAccountsByOwner(governance, {
        programId: TOKEN_PROGRAM_ID,
      })
      .catch(() => null);

    return resp?.value || [];
  }

  async fetchTokenPrices(tokenMintAddresses: string[]) {
    let prices: {
      [tokenMintAddress: string]: number;
    } = {};
    let mints: {
      [tokenMintAddress: string]: Awaited<ReturnType<HeliusService['getTokenMintInfo']>>;
    } = {};

    const batches = batch(tokenMintAddresses, 50);

    await batches.reduce(
      (acc, tokenMintAddresses) =>
        acc.then(() =>
          this.fetchTokenBatchPrices(tokenMintAddresses).then(
            ({ prices: tokenPrices, mints: mintsInfo }) => {
              prices = { ...prices, ...tokenPrices };
              mints = { ...mints, ...mintsInfo };
              return wait(500);
            },
          ),
        ),
      Promise.resolve(true),
    );

    return { prices, mints };
  }

  async fetchTokenBatchPrices(tokenMintAddresses: string[]) {
    const resp = await fetch(`https://price.jup.ag/v4/price?ids=${tokenMintAddresses.join(',')}`);
    const data = (await resp.json())['data'];
    const prices = Object.keys(data).reduce((acc, mint) => {
      acc[mint] = data[mint].price;
      return acc;
    }, {} as { [tokenMintAddress: string]: number });

    const mints = await Promise.all(
      tokenMintAddresses.map((mint) =>
        this.heliusService.getTokenMintInfo(new PublicKey(mint), 'mainnet'),
      ),
    ).then((mints) =>
      mints.reduce((acc, mint) => {
        acc[mint.publicKey.toBase58()] = mint;
        return acc;
      }, {} as { [mint: string]: Awaited<ReturnType<HeliusService['getTokenMintInfo']>> }),
    );

    return { prices, mints };
  }
}
