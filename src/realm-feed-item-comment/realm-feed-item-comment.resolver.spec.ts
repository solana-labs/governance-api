import { Test, TestingModule } from '@nestjs/testing';

import { RealmFeedItemCommentResolver } from './realm-feed-item-comment.resolver';

describe('RealmFeedItemCommentResolver', () => {
  let resolver: RealmFeedItemCommentResolver;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RealmFeedItemCommentResolver],
    }).compile();

    resolver = module.get<RealmFeedItemCommentResolver>(RealmFeedItemCommentResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });
});
