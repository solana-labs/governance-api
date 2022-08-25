import { Test, TestingModule } from '@nestjs/testing';
import { RealmTreasuryResolver } from './realm-treasury.resolver';

describe('RealmTreasuryResolver', () => {
  let resolver: RealmTreasuryResolver;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RealmTreasuryResolver],
    }).compile();

    resolver = module.get<RealmTreasuryResolver>(RealmTreasuryResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });
});
