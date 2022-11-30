import { Test, TestingModule } from '@nestjs/testing';

import { FollowFeedService } from './follow-feed.service';

describe('FollowFeedService', () => {
  let service: FollowFeedService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FollowFeedService],
    }).compile();

    service = module.get<FollowFeedService>(FollowFeedService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
