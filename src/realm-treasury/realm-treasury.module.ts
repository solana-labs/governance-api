import { CacheModule, Module } from '@nestjs/common';

import { ConfigModule } from '@src/config/config.module';
import { OnChainModule } from '@src/on-chain/on-chain.module';

import { RealmTreasuryResolver } from './realm-treasury.resolver';
import { RealmTreasuryService } from './realm-treasury.service';

@Module({
  imports: [CacheModule.register(), ConfigModule, OnChainModule],
  providers: [RealmTreasuryService, RealmTreasuryResolver],
  exports: [RealmTreasuryService],
})
export class RealmTreasuryModule {}
