import { Module } from '@nestjs/common';

import { HolaplexModule } from '@src/holaplex/holaplex.module';

import { RealmMemberResolver } from './realm-member.resolver';
import { RealmMemberService } from './realm-member.service';

@Module({
  imports: [HolaplexModule],
  providers: [RealmMemberResolver, RealmMemberService],
  exports: [RealmMemberService],
})
export class RealmMemberModule {}
