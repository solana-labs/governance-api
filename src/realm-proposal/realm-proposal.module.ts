import { Module } from '@nestjs/common';

import { HolaplexModule } from '@src/holaplex/holaplex.module';
import { RealmSettingsModule } from '@src/realm-settings/realm-settings.module';

import { RealmProposalResolver } from './realm-proposal.resolver';
import { RealmProposalService } from './realm-proposal.service';

@Module({
  imports: [HolaplexModule, RealmSettingsModule],
  providers: [RealmProposalResolver, RealmProposalService],
  exports: [RealmProposalService],
})
export class RealmProposalModule {}
