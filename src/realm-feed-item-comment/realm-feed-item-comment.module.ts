import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { RealmFeedItemComment } from './entities/RealmFeedItemComment.entity';
import { RealmFeedItemCommentVote } from './entities/RealmFeedItemCommentVote.entity';
import { RealmFeedItemCommentResolver } from './realm-feed-item-comment.resolver';
import { RealmFeedItemCommentService } from './realm-feed-item-comment.service';

@Module({
  imports: [TypeOrmModule.forFeature([RealmFeedItemComment, RealmFeedItemCommentVote])],
  providers: [RealmFeedItemCommentService, RealmFeedItemCommentResolver],
})
export class RealmFeedItemCommentModule {}
