import { Test, TestingModule } from '@nestjs/testing';

import { EcosystemFeedResolver } from './ecosystem-feed.resolver';

describe('EcosystemFeedResolver', () => {
  let resolver: EcosystemFeedResolver;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EcosystemFeedResolver],
    }).compile();

    resolver = module.get<EcosystemFeedResolver>(EcosystemFeedResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });
});
