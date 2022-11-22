import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  ConfirmedSignatureInfo,
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
  SignaturesForAddressOptions,
} from '@solana/web3.js';
import { Repository } from 'typeorm';

import * as errors from '@lib/errors/gql';

import { ConfigService } from '@src/config/config.service';

import { DiscordUser } from './entities/DiscordUser.entity';

const MINIMUM_SOL = 0.1;
const MAX_TXS_TO_SCAN = 10000;

type WalletAge = {
  txId: string;
  slot: number;
  timestamp: number;
  date: string;
  numTransactions: number;
};

type PublicKeyStrObj = { publicKeyStr: string };

const HELIUS_BASE_URL = 'https://api.helius.xyz/v0';

@Injectable()
export class DiscordUserService {
  constructor(
    @InjectRepository(DiscordUser)
    private readonly discordUserRepository: Repository<DiscordUser>,
    private readonly configService: ConfigService,
  ) {}

  heliusUrlOptions() {
    return `?api-key=${this.configService.get('helius.apiKey')}`
  }

  heliusTxUrl(address: string) {
    return `${HELIUS_BASE_URL}/addresses/${address}/transactions${this.heliusUrlOptions()}`
  }

  heliusBalancesUrl(address: string) {
    return `${HELIUS_BASE_URL}/addresses/${address}/balances${this.heliusUrlOptions()}`;
  }

  heliusWebhookUrl(webhookId: string) {
    return `${HELIUS_BASE_URL}/webhooks/${webhookId}/${this.heliusUrlOptions()}`;
  }

  heliusAddressesUrl(publicKey: string) {
    return `${HELIUS_BASE_URL}/addresses/${publicKey}/transactions${this.heliusUrlOptions()}`;
  }

  async activeWithin30Days(publicKey: string) {
    const req = await fetch(this.heliusAddressesUrl(publicKey));
    const recentTxes = await req.json();
  
    if (recentTxes.length) {
      const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;
      const timestampThirtyDaysAgo = new Date().getTime() - thirtyDaysInMs;
      const mostRecentTxTimestamp = recentTxes[0].timestamp * 1000;
  
      console.info({ mostRecentTxTimestamp, timestampThirtyDaysAgo });
      return mostRecentTxTimestamp >= timestampThirtyDaysAgo;
    }
    return null;
  }
  
  async getSolBalance(publicKey: string) {
    console.info({ url: this.heliusBalancesUrl(publicKey) });
    const response = await fetch(this.heliusBalancesUrl(publicKey));
    const responseJson = await response.json();
    console.info({ responseJson });
    const { nativeBalance }: { nativeBalance: number } = responseJson;
  
    console.info({ nativeBalance });
  
    return nativeBalance / LAMPORTS_PER_SOL >= MINIMUM_SOL;
  }
  
  async getMetadataForUser(publicKey: PublicKey) {
    const walletAge = await this.getLargeAmountOfTransactions(publicKey.toBase58(), MAX_TXS_TO_SCAN);
    const hasMinimumSol = await this.getSolBalance(publicKey.toBase58());
    const isRecentlyActive = await this.activeWithin30Days(publicKey.toBase58());
  
    return {
      first_wallet_transaction: walletAge?.date ?? null,
      most_recent_wallet_transaction: isRecentlyActive ? 1 : 0,
      has_minimum_sol: hasMinimumSol ? 1 : 0,
    };
  }

  async getAccessTokenWithRefreshToken(refreshToken: string) {
    const response = await fetch('https://discord.com/api/v10/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: JSON.stringify({
        client_id: this.configService.get('discord.clientId'),
        client_secret: this.configService.get('discord.clientSecret'),
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });
  
    const { access_token: accessToken } = await response.json();
    return accessToken;
  }

  // Updates the Helius Webhook account addresses field
  async updateWebhookAddressList() {
      return this.discordUserRepository.query(
          'select "publicKeyStr" from discord_user ORDER BY "created" DESC',
      ).then((publicKeyStrs: PublicKeyStrObj[]) => {
        const publicKeys: string[] = publicKeyStrs.map((obj) => obj.publicKeyStr);
        console.log('PUT-ing the publicKeyStrs:', publicKeys.length);
      
        const url = this.heliusWebhookUrl(this.configService.get('helius.webhookId'));
        return fetch(url, {
          body: JSON.stringify({
            webhookURL: this.configService.get('helius.webhookUrl'),
            accountAddresses: publicKeys,
            transactionTypes: this.configService.get('helius.webhookTransactionTypes'),
          }),
          method: 'PUT',
        });
      }).then((resp) => {
        console.log("Webhook put result:", resp.status);
      });
  }

  /**
   * Creates a new Discord user
   */
  createDiscordUser(authId: string, publicKey: PublicKey, refreshToken: string) {
    try {
      return this.discordUserRepository
        .upsert(
          {
            authId,
            publicKeyStr: publicKey.toBase58(),
            refreshToken,
          },
          { conflictPaths: ['authId'] },
        );
    } catch (e) {
      throw new errors.Exception(e);
    }
  }

  async getLargeAmountOfTransactions(
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
          this.heliusTxUrl(address) +
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
            client_id: this.configService.get('discord.clientId'),
            client_secret: this.configService.get('discord.clientSecret'),
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
        accessToken = await this.getAccessTokenWithRefreshToken(discordUser.refreshToken);
      } else {
        throw new Error('No access / refresh token found!');
      }
    }

    const metadata = await this.getMetadataForUser(publicKey);
    console.info({ metadata });

    const putResult = await fetch(
      `https://discord.com/api/users/@me/applications/${this.configService.get('discord.clientId')}/role-connection`,
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