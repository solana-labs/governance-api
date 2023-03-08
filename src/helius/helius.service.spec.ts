import { Test, TestingModule } from '@nestjs/testing';

import { HeliusService } from './helius.service';

describe('HeliusService', () => {
  let service: HeliusService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HeliusService],
    }).compile();

    service = module.get<HeliusService>(HeliusService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
