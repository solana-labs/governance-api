import { Test, TestingModule } from '@nestjs/testing';

import { OnChainService } from './on-chain.service';

describe('OnChainService', () => {
  let service: OnChainService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OnChainService],
    }).compile();

    service = module.get<OnChainService>(OnChainService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
