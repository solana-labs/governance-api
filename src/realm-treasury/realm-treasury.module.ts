import { CacheModule, Module } from '@nestjs/common';

import { ConfigModule } from '@src/config/config.module';
import { HeliusModule } from '@src/helius/helius.module';

import { RealmTreasuryResolver } from './realm-treasury.resolver';
import { RealmTreasuryService } from './realm-treasury.service';

@Module({
  imports: [CacheModule.register(), ConfigModule, HeliusModule],
  providers: [RealmTreasuryService, RealmTreasuryResolver],
  exports: [RealmTreasuryService],
})
export class RealmTreasuryModule {}
