import { CacheModule, Module } from '@nestjs/common';

import { ConfigModule } from '@src/config/config.module';
import { RealmSettingsModule } from '@src/realm-settings/realm-settings.module';
import { RealmTreasuryModule } from '@src/realm-treasury/realm-treasury.module';

import {
  RealmHubResolver,
  RealmHubInfoFaqItemResolver,
  RealmHubInfoTokenDetailsResolver,
  RealmHubInfoTeamMemberResolver,
} from './realm-hub.resolver';
import { RealmHubService } from './realm-hub.service';

@Module({
  imports: [CacheModule.register(), ConfigModule, RealmSettingsModule, RealmTreasuryModule],
  providers: [
    RealmHubService,
    RealmHubResolver,
    RealmHubInfoFaqItemResolver,
    RealmHubInfoTokenDetailsResolver,
    RealmHubInfoTeamMemberResolver,
  ],
  exports: [RealmHubService],
})
export class RealmHubModule {}
