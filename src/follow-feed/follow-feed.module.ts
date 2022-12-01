import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ConfigModule } from '@src/config/config.module';
import { RealmFeedItem } from '@src/realm-feed-item/entities/RealmFeedItem.entity';
import { RealmFeedItemModule } from '@src/realm-feed-item/realm-feed-item.module';
import { User } from '@src/user/entities/User.entity';

import { FollowFeedResolver } from './follow-feed.resolver';
import { FollowFeedService } from './follow-feed.service';

@Module({
  imports: [ConfigModule, RealmFeedItemModule, TypeOrmModule.forFeature([RealmFeedItem, User])],
  providers: [FollowFeedService, FollowFeedResolver],
  exports: [FollowFeedService],
})
export class FollowFeedModule {}
