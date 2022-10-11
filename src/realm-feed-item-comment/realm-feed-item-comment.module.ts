import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ConfigModule } from '@src/config/config.module';

import { RealmFeedItemComment } from './entities/RealmFeedItemComment.entity';
import { RealmFeedItemCommentVote } from './entities/RealmFeedItemCommentVote.entity';
import { RealmFeedItemCommentResolver } from './realm-feed-item-comment.resolver';
import { RealmFeedItemCommentService } from './realm-feed-item-comment.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([RealmFeedItemComment, RealmFeedItemCommentVote]),
    ConfigModule,
  ],
  providers: [RealmFeedItemCommentService, RealmFeedItemCommentResolver],
  exports: [RealmFeedItemCommentService],
})
export class RealmFeedItemCommentModule {}
