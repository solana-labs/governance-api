import {
  SolanaSdkFactory,
  NodeDialectSolanaWalletAdapter,
} from '@dialectlabs/blockchain-sdk-solana';
import { Dialect, Environment } from '@dialectlabs/sdk';
import { Module } from '@nestjs/common';

import { ConfigModule } from '@src/config/config.module';

import { ConfigService } from '@src/config/config.service';

import { DialectSdk } from './dialect-sdk';
import { DialectService } from './dialect.service';

@Module({
  imports: [ConfigModule],
  providers: [
    DialectService,
    {
      provide: DialectSdk,
      useFactory: (configService: ConfigService) => {
        // return Dialect.sdk(
        //   {
        //     environment: configService.get('external.dialectSdkEnvironment') as Environment,
        //   },
        //   SolanaSdkFactory.create({
        //     wallet: NodeDialectSolanaWalletAdapter.create(),
        //   }),
        // );
        return null;
      },
      inject: [ConfigService],
    },
  ],
  exports: [DialectService],
})
export class DialectModule {}
