import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ConfigModule } from '@src/config/config.module';
import { HeliusModule } from '@src/helius/helius.module';
import { RealmFeedItemModule } from '@src/realm-feed-item/realm-feed-item.module';
import { RealmGovernanceModule } from '@src/realm-governance/realm-governance.module';
import { RealmHubModule } from '@src/realm-hub/realm-hub.module';
import { RealmMemberModule } from '@src/realm-member/realm-member.module';
import { RealmProposalModule } from '@src/realm-proposal/realm-proposal.module';
import { RealmSettingsModule } from '@src/realm-settings/realm-settings.module';
import { RealmTreasuryModule } from '@src/realm-treasury/realm-treasury.module';
import { StaleCacheModule } from '@src/stale-cache/stale-cache.module';
import { User } from '@src/user/entities/User.entity';

import { Realm } from './entities/Realm.entity';
import {
  RealmFaqItemResolver,
  RealmResolver,
  RealmTeamMemberResolver,
  RealmTokenDetailsResolver,
} from './realm.resolver';
import { RealmService } from './realm.service';

@Module({
  imports: [
    ConfigModule,
    HeliusModule,
    StaleCacheModule,
    RealmGovernanceModule,
    RealmHubModule,
    RealmMemberModule,
    RealmProposalModule,
    RealmSettingsModule,
    RealmTreasuryModule,
    TypeOrmModule.forFeature([Realm, User]),
    forwardRef(() => RealmFeedItemModule),
  ],
  providers: [
    RealmFaqItemResolver,
    RealmResolver,
    RealmService,
    RealmTeamMemberResolver,
    RealmTokenDetailsResolver,
  ],
  exports: [RealmService],
})
export class RealmModule {}
