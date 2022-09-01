import { CacheModule, Module } from '@nestjs/common';

import { HolaplexModule } from '@src/holaplex/holaplex.module';
import { OnChainModule } from '@src/on-chain/on-chain.module';
import { RealmGovernanceModule } from '@src/realm-governance/realm-governance.module';
import { RealmMemberModule } from '@src/realm-member/realm-member.module';

import { RealmProposalGQLService } from './realm-proposal.gql.service';
import { RealmProposalResolver } from './realm-proposal.resolver';
import { RealmProposalService } from './realm-proposal.service';

@Module({
  imports: [
    CacheModule.register(),
    HolaplexModule,
    OnChainModule,
    RealmGovernanceModule,
    RealmMemberModule,
  ],
  providers: [RealmProposalResolver, RealmProposalGQLService, RealmProposalService],
  exports: [RealmProposalGQLService, RealmProposalService],
})
export class RealmProposalModule {}
