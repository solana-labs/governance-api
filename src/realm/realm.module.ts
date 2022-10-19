import { Module, forwardRef } from '@nestjs/common';

import { ConfigModule } from '@src/config/config.module';
import { HolaplexModule } from '@src/holaplex/holaplex.module';
import { RealmFeedItemModule } from '@src/realm-feed-item/realm-feed-item.module';
import { RealmMemberModule } from '@src/realm-member/realm-member.module';
import { RealmProposalModule } from '@src/realm-proposal/realm-proposal.module';
import { RealmSettingsModule } from '@src/realm-settings/realm-settings.module';
import { StaleCacheModule } from '@src/stale-cache/stale-cache.module';

import { RealmResolver, RealmDropdownListItemResolver } from './realm.resolver';
import { RealmService } from './realm.service';

@Module({
  imports: [
    ConfigModule,
    StaleCacheModule,
    HolaplexModule,
    RealmMemberModule,
    RealmProposalModule,
    RealmSettingsModule,
    forwardRef(() => RealmFeedItemModule),
  ],
  providers: [RealmResolver, RealmDropdownListItemResolver, RealmService],
  exports: [RealmService],
})
export class RealmModule {}
