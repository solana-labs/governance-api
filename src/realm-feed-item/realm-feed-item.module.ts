import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { RealmFeedItemCommentModule } from '@src/realm-feed-item-comment/realm-feed-item-comment.module';
import { RealmPostModule } from '@src/realm-post/realm-post.module';
import { RealmProposalModule } from '@src/realm-proposal/realm-proposal.module';
import { TaskDedupeModule } from '@src/task-dedupe/task-dedupe.module';

import { RealmFeedItem } from './entities/RealmFeedItem.entity';
import { RealmFeedItemVote } from './entities/RealmFeedItemVote.entity';
import { RealmFeedItemGQLService } from './realm-feed-item.gql.service';
import {
  RealmFeedItemResolver,
  RealmFeedItemPostResolver,
  RealmFeedItemProposalResolver,
} from './realm-feed-item.resolver';
import { RealmFeedItemService } from './realm-feed-item.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([RealmFeedItem, RealmFeedItemVote]),
    RealmPostModule,
    RealmProposalModule,
    TaskDedupeModule,
    RealmFeedItemCommentModule,
  ],
  providers: [
    RealmFeedItemResolver,
    RealmFeedItemGQLService,
    RealmFeedItemService,
    RealmFeedItemPostResolver,
    RealmFeedItemProposalResolver,
  ],
  exports: [RealmFeedItemGQLService, RealmFeedItemService],
})
export class RealmFeedItemModule {}
