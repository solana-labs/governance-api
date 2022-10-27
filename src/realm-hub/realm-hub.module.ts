import { CacheModule, Module } from '@nestjs/common';

import { ConfigModule } from '@src/config/config.module';
import { RealmSettingsModule } from '@src/realm-settings/realm-settings.module';
import { RealmTreasuryModule } from '@src/realm-treasury/realm-treasury.module';
import { StaleCacheModule } from '@src/stale-cache/stale-cache.module';

import {
  RealmHubInfoFaqItemResolver,
  RealmHubInfoResolver,
  RealmHubInfoTeamMemberResolver,
  RealmHubInfoTokenDetailsResolver,
  RealmHubResolver,
} from './realm-hub.resolver';
import { RealmHubService } from './realm-hub.service';

@Module({
  imports: [
    CacheModule.register(),
    ConfigModule,
    RealmSettingsModule,
    RealmTreasuryModule,
    StaleCacheModule,
  ],
  providers: [
    RealmHubInfoFaqItemResolver,
    RealmHubInfoResolver,
    RealmHubInfoTeamMemberResolver,
    RealmHubInfoTokenDetailsResolver,
    RealmHubResolver,
    RealmHubService,
  ],
  exports: [RealmHubService],
})
export class RealmHubModule {}
