import { Test, TestingModule } from '@nestjs/testing';

import { HolaplexService } from './holaplex.service';

describe('HolaplexService', () => {
  let service: HolaplexService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HolaplexService],
    }).compile();

    service = module.get<HolaplexService>(HolaplexService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
