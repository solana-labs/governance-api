import { getFavoriteDomain } from '@bonfida/spl-name-service';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  ConfirmedSignatureInfo,
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
  SignaturesForAddressOptions,
} from '@solana/web3.js';
import { Repository } from 'typeorm';

import { ConfigService } from '@src/config/config.service';

import { DiscordUser } from './entities/DiscordUser.entity';

type WalletAge = {
  txId: string;
  slot: number;
  timestamp: number;
  date: string;
  numTransactions: number;
};

type PublicKeyStrObj = { publicKeyStr: string };

const HELIUS_BASE_URL = 'https://api.helius.xyz/v0';
const MINIMUM_SOL = 0.1;
const MAX_TXS_TO_SCAN = 10000;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

@Injectable()
export class DiscordUserService {
  private logger = new Logger(DiscordUserService.name);

  constructor(
    @InjectRepository(DiscordUser)
    private readonly discordUserRepository: Repository<DiscordUser>,
    private readonly configService: ConfigService,
  ) {}

  heliusUrlOptions() {
    return `?api-key=${this.configService.get('helius.apiKey')}`;
  }

  heliusTxUrl(address: string) {
    return `${HELIUS_BASE_URL}/addresses/${address}/transactions${this.heliusUrlOptions()}`;
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

  async getMostRecentTxTimestamp(publicKey: string) {
    const req = await fetch(this.heliusAddressesUrl(publicKey));
    const recentTxes = await req.json();
    if (recentTxes.length) {
      const mostRecentTxTimestamp = recentTxes[0].timestamp * 1000;
      return new Date(mostRecentTxTimestamp).toISOString().split('T')[0];
    }
    return null;
  }

  async getSolBalance(publicKey: string) {
    this.logger.verbose({ url: this.heliusBalancesUrl(publicKey) });
    const response = await fetch(this.heliusBalancesUrl(publicKey));
    const responseJson = await response.json();
    const { nativeBalance }: { nativeBalance: number } = responseJson;
    this.logger.verbose({
      publicKey,
      nativeBalance,
      nativeBalanceSol: nativeBalance / LAMPORTS_PER_SOL >= MINIMUM_SOL,
    });

    return nativeBalance / LAMPORTS_PER_SOL >= MINIMUM_SOL;
  }

  async getMetadataForUser(publicKey: PublicKey, withDelay = 0) {
    const walletAge = await this.getLargeAmountOfTransactions(
      publicKey.toBase58(),
      MAX_TXS_TO_SCAN,
    );
    const hasMinimumSol = await delay(withDelay).then(() =>
      this.getSolBalance(publicKey.toBase58()),
    );
    const mostRecentTxTimestamp = await this.getMostRecentTxTimestamp(publicKey.toBase58());

    return {
      first_wallet_transaction: walletAge?.date ?? null,
      most_recent_wallet_transaction: mostRecentTxTimestamp,
      has_minimum_sol: hasMinimumSol ? 1 : 0,
    };
  }

  async getAccessTokenWithRefreshToken(refreshToken: string) {
    const body = new URLSearchParams({
      client_id: this.configService.get('discord.clientId'),
      client_secret: this.configService.get('discord.clientSecret'),
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }).toString();

    const response = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });

    const { access_token: accessToken, refresh_token } = await response.json();
    return { accessToken, refreshToken: refresh_token };
  }

  getDiscordApplicationCredentials() {
    return {
      client_id: this.configService.get('discord.clientId'),
      client_secret: this.configService.get('discord.clientSecret'),
      public_key: this.configService.get('discord.publicKey'),
    };
  }

  // Updates the Helius Webhook account addresses field
  async updateWebhookAddressList() {
    return this.discordUserRepository
      .query('select "publicKeyStr" from discord_user ORDER BY "created" DESC')
      .then((publicKeyStrs: PublicKeyStrObj[]) => {
        const publicKeys: string[] = publicKeyStrs.map((obj) => obj.publicKeyStr);
        this.logger.verbose('Updating webhook with publicKeys:', publicKeys.length);

        const url = this.heliusWebhookUrl(this.configService.get('helius.webhookId'));
        return fetch(url, {
          body: JSON.stringify({
            webhookURL: this.configService.get('helius.webhookUrl'),
            accountAddresses: publicKeys,
            transactionTypes: this.configService.get('helius.webhookTransactionTypes'),
            webhookType: 'enhanced',
          }),
          method: 'PUT',
        });
      })
      .then((resp) => {
        if (resp.status !== 200) {
          this.logger.warn('Webhook put failed:', resp.status, resp.statusText);
        }
      });
  }

  /**
   * Creates a new Discord user
   */
  async createDiscordUser(authId: string, publicKey: PublicKey, refreshToken: string) {
    const insertResult = await this.discordUserRepository.upsert(
      {
        authId,
        publicKeyStr: publicKey.toBase58(),
        refreshToken,
      },
      { conflictPaths: ['authId'] },
    );

    return insertResult;
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
      this.logger.verbose(`Got ${data.length} transactions for ${address}`);
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
    return await this.discordUserRepository.findOne({
      where: { publicKeyStr: publicKey.toBase58() },
    });
  }

  async updateMetadataForUser(publicKey: PublicKey, _accessToken?: string | null, withDelay = 0) {
    let accessToken = _accessToken;
    if (!accessToken) {
      const discordUser = await this.getDiscordUserByPublicKey(publicKey);
      if (discordUser) {
        const newAccessAndRefreshToken = await this.getAccessTokenWithRefreshToken(
          discordUser.refreshToken,
        );

        accessToken = newAccessAndRefreshToken.accessToken;

        await this.discordUserRepository.update(discordUser.id, {
          refreshToken: newAccessAndRefreshToken.refreshToken,
        });
      } else {
        throw new Error('No access / refresh token found!');
      }
    }

    const metadata = await this.getMetadataForUser(publicKey, withDelay);
    this.logger.verbose({ metadata });

    const body = { platform_name: 'Solana', metadata };

    try {
      const connection = new Connection(process.env.RPC_ENDPOINT as string);
      const { reverse } = await getFavoriteDomain(connection, publicKey);
      this.logger.verbose({ reverse });
      body['platform_username'] = `${reverse}.sol`;
    } catch (e) {
      this.logger.verbose(e);
    }

    const { client_id: clientId } = this.getDiscordApplicationCredentials();
    const putResult = await fetch(
      `https://discord.com/api/users/@me/applications/${clientId}/role-connection`,
      {
        method: 'PUT',
        headers: {
          'authorization': `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
      },
    );

    this.logger.verbose({
      discordMetadataUpdate: putResult.status,
      discordMetadataUpdateText: putResult.statusText,
    });
  }
}
