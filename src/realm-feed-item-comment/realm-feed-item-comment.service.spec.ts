import { Test, TestingModule } from '@nestjs/testing';

import { RealmFeedItemCommentService } from './realm-feed-item-comment.service';

describe('RealmFeedItemCommentService', () => {
  let service: RealmFeedItemCommentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RealmFeedItemCommentService],
    }).compile();

    service = module.get<RealmFeedItemCommentService>(RealmFeedItemCommentService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
