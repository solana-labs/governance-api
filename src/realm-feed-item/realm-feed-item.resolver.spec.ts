import { Test, TestingModule } from '@nestjs/testing';

import { RealmFeedItemResolver } from './realm-feed-item.resolver';
import { RealmFeedItemService } from './realm-feed-item.service';

describe('RealmFeedItemResolver', () => {
  let resolver: RealmFeedItemResolver;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RealmFeedItemResolver, RealmFeedItemService],
    }).compile();

    resolver = module.get<RealmFeedItemResolver>(RealmFeedItemResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });
});
