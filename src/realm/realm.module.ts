import { Module } from '@nestjs/common';

import { HolaplexModule } from '@src/holaplex/holaplex.module';
import { RealmMemberModule } from '@src/realm-member/realm-member.module';

import { RealmResolver } from './realm.resolver';
import { RealmService } from './realm.service';

@Module({
  imports: [HolaplexModule, RealmMemberModule],
  providers: [RealmResolver, RealmService],
})
export class RealmModule {}
