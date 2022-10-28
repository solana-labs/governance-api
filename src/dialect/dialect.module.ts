import { Module } from '@nestjs/common';
import {
  Dialect,
  Environment,
} from '@dialectlabs/sdk';import {
  SolanaSdkFactory,
  NodeDialectSolanaWalletAdapter
} from '@dialectlabs/blockchain-sdk-solana';
import { DialectSdk } from './dialect-sdk';
import { DialectService } from './dialect.service';

@Module({
  providers: [
    DialectService,
    {
      provide: DialectSdk,
      useValue: Dialect.sdk(
        {
          environment: process.env.DIALECT_SDK_ENVIRONMENT as Environment,
        },
        SolanaSdkFactory.create({
          wallet: NodeDialectSolanaWalletAdapter.create(),
        }),
      ),
    },
  ],
  exports: [
    DialectService
  ],
})
export class DialectModule {}
