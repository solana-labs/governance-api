import { CacheModule, Module } from '@nestjs/common';

import { HeliusModule } from '@src/helius/helius.module';
import { RealmGovernanceModule } from '@src/realm-governance/realm-governance.module';
import { RealmMemberModule } from '@src/realm-member/realm-member.module';
import { StaleCacheModule } from '@src/stale-cache/stale-cache.module';

import { RealmProposalGQLService } from './realm-proposal.gql.service';
import { RealmProposalResolver } from './realm-proposal.resolver';
import { RealmProposalService } from './realm-proposal.service';

@Module({
  imports: [
    CacheModule.register(),
    HeliusModule,
    RealmGovernanceModule,
    RealmMemberModule,
    StaleCacheModule,
  ],
  providers: [RealmProposalResolver, RealmProposalGQLService, RealmProposalService],
  exports: [RealmProposalGQLService, RealmProposalService],
})
export class RealmProposalModule {}
