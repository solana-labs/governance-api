import { ResolveField, Resolver, Root, Query } from '@nestjs/graphql';

import { CurrentEnvironment, Environment } from '@lib/decorators/CurrentEnvironment';
import { CurrentUser } from '@lib/decorators/CurrentUser';
import * as errors from '@lib/errors/gql';
import { EitherResolver } from '@src/lib/decorators/EitherResolver';
import { RealmMemberTwitterInfo } from '@src/realm-member/dto/RealmMemberTwitterInfo';
import { RealmMemberService } from '@src/realm-member/realm-member.service';

import { User } from './dto/User';
import { UserService } from './user.service';

@Resolver(() => User)
export class UserResolver {
  constructor(
    private readonly realmMemberService: RealmMemberService,
    private readonly userService: UserService,
  ) {}

  @ResolveField(() => RealmMemberTwitterInfo, {
    description: "User's twitter handle",
    nullable: true,
  })
  @EitherResolver()
  twitterInfo(@Root() user: User, @CurrentEnvironment() environment: Environment) {
    return this.realmMemberService.getTwitterHandleForPublicKey(user.publicKey, environment);
  }

  @Query(() => User, {
    description:
      'User making the request, as determined by the jwt bearer token in the authorization header',
    nullable: true,
  })
  me(@CurrentUser() user: User | null, @CurrentEnvironment() environment: Environment) {
    if (environment === 'devnet') {
      throw new errors.UnsupportedDevnet();
    }

    return user;
  }
}
