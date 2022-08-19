import { Module } from '@nestjs/common';

import { RealmFeedItemResolver } from './realm-feed-item.resolver';
import { RealmFeedItemService } from './realm-feed-item.service';

@Module({
  providers: [RealmFeedItemResolver, RealmFeedItemService],
})
export class RealmFeedItemModule {}
