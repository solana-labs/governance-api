import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ConfigModule } from '@src/config/config.module';
import { DialectModule } from '@src/dialect/dialect.module';
import { RealmFeedItemComment } from '@src/realm-feed-item-comment/entities/RealmFeedItemComment.entity';
import { RealmFeedItemCommentModule } from '@src/realm-feed-item-comment/realm-feed-item-comment.module';
import { RealmMemberModule } from '@src/realm-member/realm-member.module';
import { RealmPost } from '@src/realm-post/entities/RealmPost.entity';
import { RealmPostModule } from '@src/realm-post/realm-post.module';
import { RealmProposalModule } from '@src/realm-proposal/realm-proposal.module';
import { RealmModule } from '@src/realm/realm.module';
import { StaleCacheModule } from '@src/stale-cache/stale-cache.module';
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
    TypeOrmModule.forFeature([RealmFeedItem, RealmFeedItemVote, RealmPost, RealmFeedItemComment]),
    RealmPostModule,
    RealmProposalModule,
    TaskDedupeModule,
    RealmFeedItemCommentModule,
    ConfigModule,
    StaleCacheModule,
    RealmMemberModule,
    DialectModule,
    forwardRef(() => RealmModule),
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
