import { Test, TestingModule } from '@nestjs/testing';

import { EcosystemFeedService } from './ecosystem-feed.service';

describe('EcosystemFeedService', () => {
  let service: EcosystemFeedService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EcosystemFeedService],
    }).compile();

    service = module.get<EcosystemFeedService>(EcosystemFeedService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
