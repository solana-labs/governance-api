import { Resolver } from '@nestjs/graphql';

import { RealmFeedService } from './realm-feed.service';

@Resolver()
export class RealmFeedResolver {
  constructor(private readonly realmFeedService: RealmFeedService) {}
}
