import { Resolver, Query, Args, ResolveField, Root, Int } from '@nestjs/graphql';
import { PublicKey } from '@solana/web3.js';

import { EitherResolver } from '@src/lib/decorators/EitherResolver';
import { PublicKeyScalar } from '@src/lib/scalars/PublicKey';
import { RealmMember } from '@src/realm-member/dto/RealmMember';
import { RealmMemberService } from '@src/realm-member/realm-member.service';

import { Realm } from './dto/Realm';
import { RealmService } from './realm.service';

@Resolver(() => Realm)
export class RealmResolver {
  constructor(
    private readonly realmService: RealmService,
    private readonly realmMemberService: RealmMemberService,
  ) {}

  @Query(() => Realm, {
    description: 'A Realm',
  })
  @EitherResolver()
  realm(
    @Args('publicKey', {
      description: 'The public key of the Realm',
      type: () => PublicKeyScalar,
    })
    publicKey: PublicKey,
  ) {
    return this.realmService.getRealm(publicKey);
  }

  @ResolveField(() => [RealmMember], {
    description: 'Get a list of members in the realm',
  })
  @EitherResolver()
  members(@Root() realm: Realm) {
    return this.realmMemberService.getMembersForRealm(realm.publicKey);
  }

  @ResolveField(() => Int, {
    description: 'Count of the number of members in this Realm',
  })
  @EitherResolver()
  membersCount(@Root() realm: Realm) {
    return this.realmMemberService.getMembersCountForRealm(realm.publicKey);
  }
}
