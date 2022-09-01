import { Test, TestingModule } from '@nestjs/testing';

import { RealmGovernanceService } from './realm-governance.service';

describe('RealmGovernanceService', () => {
  let service: RealmGovernanceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RealmGovernanceService],
    }).compile();

    service = module.get<RealmGovernanceService>(RealmGovernanceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
