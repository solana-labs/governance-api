import { Test, TestingModule } from '@nestjs/testing';

import { RealmService } from './realm.service';

describe('RealmService', () => {
  let service: RealmService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RealmService],
    }).compile();

    service = module.get<RealmService>(RealmService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
