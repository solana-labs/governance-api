import { Test, TestingModule } from '@nestjs/testing';

import { RealmMemberService } from './realm-member.service';

describe('RealmMemberService', () => {
  let service: RealmMemberService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RealmMemberService],
    }).compile();

    service = module.get<RealmMemberService>(RealmMemberService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
