import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ConfigModule } from '@src/config/config.module';
import { HolaplexModule } from '@src/holaplex/holaplex.module';
import { OnChainModule } from '@src/on-chain/on-chain.module';
import { RealmFeedItemModule } from '@src/realm-feed-item/realm-feed-item.module';
import { RealmHubModule } from '@src/realm-hub/realm-hub.module';
import { RealmMemberModule } from '@src/realm-member/realm-member.module';
import { RealmProposalModule } from '@src/realm-proposal/realm-proposal.module';
import { RealmSettingsModule } from '@src/realm-settings/realm-settings.module';
import { RealmTreasuryModule } from '@src/realm-treasury/realm-treasury.module';
import { StaleCacheModule } from '@src/stale-cache/stale-cache.module';

import { Realm } from './entities/Realm.entity';
import {
  RealmDropdownListItemResolver,
  RealmFaqItemResolver,
  RealmResolver,
  RealmTeamMemberResolver,
  RealmTokenDetailsResolver,
} from './realm.resolver';
import { RealmService } from './realm.service';

@Module({
  imports: [
    ConfigModule,
    StaleCacheModule,
    HolaplexModule,
    OnChainModule,
    RealmHubModule,
    RealmMemberModule,
    RealmProposalModule,
    RealmSettingsModule,
    RealmTreasuryModule,
    TypeOrmModule.forFeature([Realm]),
    forwardRef(() => RealmFeedItemModule),
  ],
  providers: [
    RealmDropdownListItemResolver,
    RealmFaqItemResolver,
    RealmResolver,
    RealmService,
    RealmTeamMemberResolver,
    RealmTokenDetailsResolver,
  ],
  exports: [RealmService],
})
export class RealmModule {}
