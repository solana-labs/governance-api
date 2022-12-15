import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ConfigModule } from '@src/config/config.module';
import { RealmFeedItemModule } from '@src/realm-feed-item/realm-feed-item.module';
import { RealmModule } from '@src/realm/realm.module';

import { DiscoverPageResolver, DiscoverPageSpotlightItemResolver } from './discover-page.resolver';
import { DiscoverPageService } from './discover-page.service';
import { DiscoverPage } from './entities/DiscoverPage.entity';

@Module({
  imports: [
    ConfigModule,
    RealmModule,
    RealmFeedItemModule,
    TypeOrmModule.forFeature([DiscoverPage]),
  ],
  providers: [DiscoverPageService, DiscoverPageResolver, DiscoverPageSpotlightItemResolver],
  exports: [DiscoverPageService],
})
export class DiscoverPageModule {}
