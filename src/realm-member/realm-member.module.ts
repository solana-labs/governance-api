import { CacheModule, Module } from '@nestjs/common';

import { ConfigModule } from '@src/config/config.module';
import { HolaplexModule } from '@src/holaplex/holaplex.module';

import { RealmMemberResolver } from './realm-member.resolver';
import { RealmMemberService } from './realm-member.service';

@Module({
  imports: [CacheModule.register(), ConfigModule, HolaplexModule],
  providers: [RealmMemberResolver, RealmMemberService],
  exports: [RealmMemberService],
})
export class RealmMemberModule {}
