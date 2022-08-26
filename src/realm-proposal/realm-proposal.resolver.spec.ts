import { Test, TestingModule } from '@nestjs/testing';

import { RealmProposalResolver } from './realm-proposal.resolver';
import { RealmProposalService } from './realm-proposal.service';

describe('RealmProposalResolver', () => {
  let resolver: RealmProposalResolver;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RealmProposalResolver, RealmProposalService],
    }).compile();

    resolver = module.get<RealmProposalResolver>(RealmProposalResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });
});
