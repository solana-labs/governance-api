import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfirmedSignatureInfo, Connection, LAMPORTS_PER_SOL, PublicKey, SignaturesForAddressOptions } from '@solana/web3.js';
import { Repository } from 'typeorm';

import * as errors from '@lib/errors/gql';

import { DiscordUser } from './entities/DiscordUser.entity';
import { access } from 'fs';
import { Wallet } from '@dialectlabs/sdk';

const MINIMUM_SOL = 0.1;
const MAX_TXS_TO_SCAN = 10000;
const clientId = '1042836142560645130';
const clientSecret = 'xFRUiukWAXwJmn0nkK2xK5EfEFKtgzuH';

const HELIUS_BASE_URL = 'https://api.helius.xyz/v0';
const options = '?api-key=8ff76c55-268e-4c41-9916-cb55b8132089';
const HELIUS_ADDRESSES_URL = `${HELIUS_BASE_URL}/addresses`;
const HELIUS_TX_URL = (address: string) =>
  `${HELIUS_BASE_URL}/addresses/${address}/transactions${options}`;
const HELIUS_BALANCES_URL = (address) =>
  `${HELIUS_BASE_URL}/addresses/${address}/balances${options}`;

type WalletAge = {
  txId: string;
  slot: number;
  timestamp: number;
  date: string;
  numTransactions: number;
};

async function getLargeAmountOfTransactions(
  address: string,
  maxCount: number,
): Promise<WalletAge | undefined> {
  let numTxs = 0;
  const connection = new Connection(process.env.RPC_ENDPOINT as string);
  let oldestTransaction: ConfirmedSignatureInfo | undefined;

  // Find oldest tx
  const options: SignaturesForAddressOptions = {};
  while (numTxs < maxCount) {
    const data = await connection.getSignaturesForAddress(new PublicKey(address), options);
    if (data.length === 0) {
      break;
    }
    console.log(`Got ${data.length} transactions`);
    numTxs += data.length;

    // API data is already sorted in descending order
    oldestTransaction = data[data.length - 1];
    options.before = oldestTransaction.signature;
  }

  if (oldestTransaction) {
    let blockTime: number;
    if (oldestTransaction.blockTime) {
      blockTime = oldestTransaction.blockTime;
    } else {
      console.log(oldestTransaction.signature);
      const url =
        HELIUS_TX_URL(address) +
        `&before=${oldestTransaction.signature}&until=${oldestTransaction.signature}`;
      const response = await (await fetch(url)).json();
      blockTime = response.timestamp;
    }

    const date = new Date(0);
    date.setUTCSeconds(blockTime);
    return {
      txId: oldestTransaction.signature,
      slot: oldestTransaction.slot,
      timestamp: blockTime,
      date: date.toISOString().split('T')[0],
      numTransactions: numTxs,
    };
  } else {
    return undefined;
  }
}

const activeWithin30Days = async (publicKey: string) => {
  const req = await fetch(`${HELIUS_ADDRESSES_URL}/${publicKey}/transactions${options}`);
  const recentTxes = await req.json();

  if (recentTxes.length) {
    const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;
    const timestampThirtyDaysAgo = new Date().getTime() - thirtyDaysInMs;
    const mostRecentTxTimestamp = recentTxes[0].timestamp * 1000;

    console.info({ mostRecentTxTimestamp, timestampThirtyDaysAgo });
    return mostRecentTxTimestamp >= timestampThirtyDaysAgo;
  }
  return null;
};

const getSolBalance = async (publicKey: string) => {
  console.info({ url: HELIUS_BALANCES_URL(publicKey) });
  const response = await fetch(HELIUS_BALANCES_URL(publicKey));
  const responseJson = await response.json();
  console.info({ responseJson });
  const { nativeBalance }: { nativeBalance: number } = responseJson;

  console.info({ nativeBalance });

  return nativeBalance / LAMPORTS_PER_SOL >= MINIMUM_SOL;
};

const getMetadataForUser = async (publicKey: PublicKey) => {
  const walletAge = await getLargeAmountOfTransactions(publicKey.toBase58(), MAX_TXS_TO_SCAN);
  const hasMinimumSol = await getSolBalance(publicKey.toBase58());
  const isRecentlyActive = await activeWithin30Days(publicKey.toBase58());

  return {
    first_wallet_transaction: walletAge?.date ?? null,
    most_recent_wallet_transaction: isRecentlyActive ? 1 : 0,
    has_minimum_sol: hasMinimumSol ? 1 : 0,
  };
};

const getAccessTokenWithRefreshToken = async (refreshToken: string) => {
  const response = await fetch('https://discord.com/api/v10/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  const { access_token: accessToken } = await response.json();
  return accessToken;
};

@Injectable()
export class DiscordUserService {
  constructor(
    @InjectRepository(DiscordUser)
    private readonly discordUserRepository: Repository<DiscordUser>,
  ) {}

  /**
   * Creates a new Discord user
   */
  createDiscordUser(authId: string, publicKey: PublicKey, refreshToken: string) {
    try {
      return this.discordUserRepository.upsert(
        {
          authId,
          publicKeyStr: publicKey.toBase58(),
          refreshToken,
        },
        { conflictPaths: ['authId'] },
      );

      // return this.discordUserRepository.save(discordUser);
    } catch (e) {
      throw new errors.Exception(e);
    }
  }

  /**
   * Returns a user by their ID
   */
  async getDiscordUserByPublicKey(publicKey: PublicKey) {
    try {
      return await this.discordUserRepository.findOne({
        where: { publicKeyStr: publicKey.toBase58() },
      });
    } catch (e) {
      console.error(e);
      throw new errors.Exception(e);
    }
  }

  async refreshDiscordMetadataForPublicKey(publicKey: PublicKey) {
    const discordUser = await this.getDiscordUserByPublicKey(publicKey);
    if (discordUser) {
      const { refreshToken } = discordUser;

      try {
        const response = await fetch('https://discord.com/api/v10/oauth2/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: JSON.stringify({
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
          }),
        });

        const { access_token: accessToken } = await response.json();
        await this.updateMetadataForUser(new PublicKey(publicKey), accessToken);
        return { publicKey };
      } catch (e) {
        return null;
      }
    }
  }

  async updateMetadataForUser(publicKey: PublicKey, _accessToken) {
    let accessToken = _accessToken;
    if (!accessToken) {
      const discordUser = await this.getDiscordUserByPublicKey(publicKey);
      if (discordUser) {
        accessToken = await getAccessTokenWithRefreshToken(discordUser.refreshToken);
      } else {
        throw new Error('No access / refresh token found!');
      }
    }

    const metadata = await getMetadataForUser(publicKey);
    console.info({ metadata });

    const putResult = await fetch(
      `https://discord.com/api/users/@me/applications/${clientId}/role-connection`,
      {
        method: 'PUT',
        headers: {
          'authorization': `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          platform_name: 'Solana',
          metadata,
        }),
      },
    );

    console.info({ putResult });
  }
}
