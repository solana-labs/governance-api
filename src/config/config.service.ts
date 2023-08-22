import { Injectable } from '@nestjs/common';
import type { Path } from '@nestjs/config';
import { ConfigService as _ConfigService } from '@nestjs/config';
import type { PublicKey } from '@solana/web3.js';

export interface Config {
  app: {
    port: number;
    host?: string;
    codeCommitedInfoUrl: string;
  };
  constants: {
    admins: PublicKey[];
    voteDecay: number;
    timeValue: number;
  };
  database: {
    host: string;
    name: string;
    password: string | undefined;
    port: number;
    username: string | undefined;
    useSsl: boolean;
  };
  discord: {
    clientId: string;
    clientSecret: string;
    oauthRedirectUri: string;
    publicKey: string;
  };
  matchdayDiscord: {
    clientId: string;
    clientSecret: string;
    publicKey: string;
    oauthRedirectUri: string;
  };
  validatorDiscord: {
    clientId: string;
    clientSecret: string;
    publicKey: string;
    oauthRedirectUri: string;
    refreshUrl: string;
  };
  external: {
    dialectSdkCredentials: string | undefined;
    dialectSdkEnvironment: string | undefined;
    discordBotKey: string | undefined;
    rpcEndpoint: string | undefined;
    rpcEndpointDevnet: string | undefined;
    twitterBearerKey: string | undefined;
  };
  helius: {
    apiKey: string;
    webhookKey: string;
    webhookId: string;
    webhookUrl: string;
    webhookTransactionTypes: string[];
  };
  simplehash: {
    apiKey: string;
  };
  jwt: {
    userSecret: string;
  };
}

@Injectable()
export class ConfigService extends _ConfigService<Config, true> {
  get<P extends Path<Config>>(path: P) {
    const value = super.get(path, { infer: true });
    return value;
  }
}
