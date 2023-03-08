import { Module } from '@nestjs/common';

import { HeliusModule } from '@src/helius/helius.module';
import { StaleCacheModule } from '@src/stale-cache/stale-cache.module';

import { RealmGovernanceService } from './realm-governance.service';

@Module({
  imports: [HeliusModule, StaleCacheModule],
  providers: [RealmGovernanceService],
  exports: [RealmGovernanceService],
})
export class RealmGovernanceModule {}
