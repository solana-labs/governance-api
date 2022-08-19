import { Resolver } from '@nestjs/graphql';

import { RealmMemberService } from './realm-member.service';

@Resolver()
export class RealmMemberResolver {
  constructor(private readonly realmMemberService: RealmMemberService) {}
}
