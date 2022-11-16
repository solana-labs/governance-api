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
import { StaleCacheModule } from '@src/stale-cache/stale-cache.module';

import { Realm } from './entities/Realm.entity';
import { RealmResolver, RealmDropdownListItemResolver } from './realm.resolver';
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
    TypeOrmModule.forFeature([Realm]),
    forwardRef(() => RealmFeedItemModule),
  ],
  providers: [RealmResolver, RealmDropdownListItemResolver, RealmService],
  exports: [RealmService],
})
export class RealmModule {}
