import { Test, TestingModule } from '@nestjs/testing';

import { DiscoverPageResolver } from './discover-page.resolver';

describe('DiscoverPageResolver', () => {
  let resolver: DiscoverPageResolver;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DiscoverPageResolver],
    }).compile();

    resolver = module.get<DiscoverPageResolver>(DiscoverPageResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });
});
