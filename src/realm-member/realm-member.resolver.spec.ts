import { Test, TestingModule } from '@nestjs/testing';

import { RealmMemberResolver } from './realm-member.resolver';
import { RealmMemberService } from './realm-member.service';

describe('RealmMemberResolver', () => {
  let resolver: RealmMemberResolver;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RealmMemberResolver, RealmMemberService],
    }).compile();

    resolver = module.get<RealmMemberResolver>(RealmMemberResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });
});
