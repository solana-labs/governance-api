import { Module } from '@nestjs/common';

import { RealmProposalModule } from '@src/realm-proposal/realm-proposal.module';

import { RealmFeedResolver } from './realm-feed.resolver';
import { RealmFeedService } from './realm-feed.service';

@Module({
  imports: [RealmProposalModule],
  providers: [RealmFeedResolver, RealmFeedService],
  exports: [RealmFeedService],
})
export class RealmFeedModule {}
