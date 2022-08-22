import { Module } from '@nestjs/common';

import { HolaplexModule } from '@src/holaplex/holaplex.module';
import { RealmSettingsModule } from '@src/realm-settings/realm-settings.module';

import { RealmProposalGQLService } from './realm-proposal.gql.service';
import { RealmProposalResolver } from './realm-proposal.resolver';
import { RealmProposalService } from './realm-proposal.service';

@Module({
  imports: [HolaplexModule, RealmSettingsModule],
  providers: [RealmProposalResolver, RealmProposalGQLService, RealmProposalService],
  exports: [RealmProposalGQLService, RealmProposalService],
})
export class RealmProposalModule {}
