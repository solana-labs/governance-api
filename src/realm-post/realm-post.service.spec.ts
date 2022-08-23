import { Test, TestingModule } from '@nestjs/testing';

import { RealmPostService } from './realm-post.service';

describe('RealmPostService', () => {
  let service: RealmPostService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RealmPostService],
    }).compile();

    service = module.get<RealmPostService>(RealmPostService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
