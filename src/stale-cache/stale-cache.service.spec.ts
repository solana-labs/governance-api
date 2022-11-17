import { Test, TestingModule } from '@nestjs/testing';

import { StaleCacheService } from './stale-cache.service';

describe('StaleCacheService', () => {
  let service: StaleCacheService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [StaleCacheService],
    }).compile();

    service = module.get<StaleCacheService>(StaleCacheService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
