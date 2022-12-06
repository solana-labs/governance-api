import { Module } from '@nestjs/common';
import { ConfigModule as _ConfigModule } from '@nestjs/config';
import { PublicKey } from '@solana/web3.js';

import type { Config } from './config.service';
import { ConfigService } from './config.service';

@Module({
  imports: [
    _ConfigModule.forRoot({
      envFilePath: '.env',
      load: [
        () => {
          const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
          const dbPort = process.env.DATABASE_PORT ? parseInt(process.env.DATABASE_PORT, 10) : 5432;

          const config: Config = {
            app: {
              port,
              host: process.env.HOST,
              codeCommitedInfoUrl: process.env.CODE_COMMITED_INFO_URL || 'https://app.realms.today',
            },
            constants: {
              admins: process.env.ADMINS
                ? JSON.parse(process.env.ADMINS).map((str) => new PublicKey(str))
                : [],
              voteDecay: process.env.CONSTANTS_VOTE_DECAY
                ? parseInt(process.env.CONSTANTS_VOTE_DECAY, 10)
                : 6,
              timeValue: process.env.CONSTANTS_TIME_VALUE
                ? parseInt(process.env.CONSTANTS_TIME_VALUE)
                : 180,
            },
            database: {
              host: process.env.DATABASE_HOST || '',
              name: process.env.DATABASE_NAME || '',
              password: process.env.DATABASE_PASSWORD,
              port: dbPort,
              username: process.env.DATABASE_USERNAME,
              useSsl: process.env.DATABASE_USE_SSL === 'true',
            },
            discord: {
              clientId: process.env.DISCORD_CONNECTION_CLIENT_ID || '',
              clientSecret: process.env.DISCORD_CONNECTION_CLIENT_SECRET || '',
              oauthRedirectUri: process.env.DISCORD_OAUTH_REDIRECT_URI || '',
            },
            external: {
              dialectSdkCredentials: process.env.DIALECT_SDK_CREDENTIALS,
              dialectSdkEnvironment: process.env.DIALECT_SDK_ENVIRONMENT,
              discordBotKey: process.env.DISCORD_BOT_KEY,
              rpcEndpoint: process.env.RPC_ENDPOINT,
              twitterBearerKey: process.env.TWITTER_API_BEARER_KEY,
            },
            helius: {
              apiKey: process.env.HELIUS_API_KEY as string,
              webhookId: process.env.HELIUS_WEBHOOK_ID as string,
              webhookUrl: process.env.HELIUS_WEBHOOK_URL as string,
              webhookTransactionTypes: (process.env.HELIUS_WEBHOOK_TRANSACTION_TYPES as string)
                .split(',')
                .map((txType) => txType.toUpperCase()),
            },
            jwt: {
              userSecret: process.env.JWT_USER_SECRET || '',
            },
          };

          return config;
        },
      ],
    }),
  ],
  providers: [ConfigService],
  exports: [ConfigService],
})
export class ConfigModule {}
