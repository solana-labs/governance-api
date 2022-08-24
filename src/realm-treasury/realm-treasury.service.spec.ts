import { Test, TestingModule } from '@nestjs/testing';

import { RealmTreasuryService } from './realm-treasury.service';

describe('RealmTreasuryService', () => {
  let service: RealmTreasuryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RealmTreasuryService],
    }).compile();

    service = module.get<RealmTreasuryService>(RealmTreasuryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
