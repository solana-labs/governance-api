import { Solana } from '@dialectlabs/blockchain-sdk-solana';
import {
  Dapps,
  DialectSdk as IDialectSdk,
  DialectSdkInfo,
  Messaging,
  Wallets,
  IdentityResolver,
  Config,
  TokenProvider,
  EncryptionKeysProvider,
} from '@dialectlabs/sdk';

export abstract class DialectSdk implements IDialectSdk<Solana> {
  readonly info: DialectSdkInfo;
  readonly config: Config;
  readonly threads: Messaging;
  readonly dapps: Dapps;
  readonly wallet: Wallets;
  readonly identity: IdentityResolver;
  readonly tokenProvider!: TokenProvider;
  readonly encryptionKeysProvider!: EncryptionKeysProvider;
  readonly blockchainSdk: Solana;
}
