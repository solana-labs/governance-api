import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ConfigModule } from '@src/config/config.module';
import { RealmFeedItem } from '@src/realm-feed-item/entities/RealmFeedItem.entity';
import { RealmFeedItemModule } from '@src/realm-feed-item/realm-feed-item.module';

import { EcosystemFeedResolver } from './ecosystem-feed.resolver';
import { EcosystemFeedService } from './ecosystem-feed.service';

@Module({
  imports: [ConfigModule, RealmFeedItemModule, TypeOrmModule.forFeature([RealmFeedItem])],
  providers: [EcosystemFeedService, EcosystemFeedResolver],
  exports: [EcosystemFeedService],
})
export class EcosystemFeedModule {}
