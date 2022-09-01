import { Module } from '@nestjs/common';

import { HolaplexModule } from '@src/holaplex/holaplex.module';

import { RealmGovernanceService } from './realm-governance.service';

@Module({
  imports: [HolaplexModule],
  providers: [RealmGovernanceService],
  exports: [RealmGovernanceService],
})
export class RealmGovernanceModule {}
