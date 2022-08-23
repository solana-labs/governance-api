import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { RealmPostModule } from '@src/realm-post/realm-post.module';
import { RealmProposalModule } from '@src/realm-proposal/realm-proposal.module';

import { RealmFeedItem } from './entities/RealmFeedItem.entity';
import { RealmFeedItemResolver } from './realm-feed-item.resolver';
import { RealmFeedItemService } from './realm-feed-item.service';

@Module({
  imports: [TypeOrmModule.forFeature([RealmFeedItem]), RealmPostModule, RealmProposalModule],
  providers: [RealmFeedItemResolver, RealmFeedItemService],
})
export class RealmFeedItemModule {}
