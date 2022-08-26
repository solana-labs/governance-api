import { Test, TestingModule } from '@nestjs/testing';

import { RealmFeedItemService } from './realm-feed-item.service';

describe('RealmFeedItemService', () => {
  let service: RealmFeedItemService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RealmFeedItemService],
    }).compile();

    service = module.get<RealmFeedItemService>(RealmFeedItemService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
