import { Resolver } from '@nestjs/graphql';

import { RealmFeedItemService } from './realm-feed-item.service';

@Resolver()
export class RealmFeedItemResolver {
  constructor(private readonly realmFeedItemService: RealmFeedItemService) {}
}
