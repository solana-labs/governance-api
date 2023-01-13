import { Module, forwardRef } from '@nestjs/common';

import { HolaplexModule } from '@src/holaplex/holaplex.module';
import { OnChainModule } from '@src/on-chain/on-chain.module';
import { StaleCacheModule } from '@src/stale-cache/stale-cache.module';

import { RealmGovernanceService } from './realm-governance.service';

@Module({
  imports: [HolaplexModule, forwardRef(() => OnChainModule), StaleCacheModule],
  providers: [RealmGovernanceService],
  exports: [RealmGovernanceService],
})
export class RealmGovernanceModule {}
