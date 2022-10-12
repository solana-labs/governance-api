import { CacheModule, Module } from '@nestjs/common';

import { RealmGovernanceModule } from '@src/realm-governance/realm-governance.module';
import { RealmSettingsModule } from '@src/realm-settings/realm-settings.module';
import { StaleCacheModule } from '@src/stale-cache/stale-cache.module';

import { OnChainService } from './on-chain.service';

@Module({
  imports: [StaleCacheModule, CacheModule.register(), RealmGovernanceModule, RealmSettingsModule],
  providers: [OnChainService],
  exports: [OnChainService],
})
export class OnChainModule {}
