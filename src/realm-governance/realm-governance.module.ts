import { Module } from '@nestjs/common';

import { HolaplexModule } from '@src/holaplex/holaplex.module';
import { StaleCacheModule } from '@src/stale-cache/stale-cache.module';

import { RealmGovernanceService } from './realm-governance.service';

@Module({
  imports: [HolaplexModule, StaleCacheModule],
  providers: [RealmGovernanceService],
  exports: [RealmGovernanceService],
})
export class RealmGovernanceModule {}
