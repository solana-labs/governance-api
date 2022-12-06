import { ResolveField, Resolver, Root, Query } from '@nestjs/graphql';

import { CurrentEnvironment, Environment } from '@lib/decorators/CurrentEnvironment';
import { CurrentUser, User as UserModel } from '@lib/decorators/CurrentUser';
import * as errors from '@lib/errors/gql';
import { ConfigService } from '@src/config/config.service';
import { EitherResolver } from '@src/lib/decorators/EitherResolver';
import { RealmMemberCivicInfo } from '@src/realm-member/dto/RealmMemberCivicInfo';
import { RealmMemberTwitterInfo } from '@src/realm-member/dto/RealmMemberTwitterInfo';
import { RealmMemberService } from '@src/realm-member/realm-member.service';
import { Realm } from '@src/realm/dto/Realm';
import { RealmService } from '@src/realm/realm.service';

import { User } from './dto/User';
import { UserService } from './user.service';

@Resolver(() => User)
export class UserResolver {
  constructor(
    private readonly configService: ConfigService,
    private readonly realmMemberService: RealmMemberService,
    private readonly realmService: RealmService,
    private readonly userService: UserService,
  ) {}

  @ResolveField(() => Boolean, {
    description: 'Is the user a site admin',
    nullable: true,
  })
  amSiteAdmin(@Root() member: User) {
    if (
      this.configService.get('constants.admins').some((adminPk) => adminPk.equals(member.publicKey))
    ) {
      return true;
    }

    return null;
  }

  @ResolveField(() => RealmMemberCivicInfo, {
    description: "User's civic handle info",
    nullable: true,
  })
  @EitherResolver()
  civicInfo(@Root() member: User, @CurrentEnvironment() environment: Environment) {
    return this.realmMemberService.getCivicHandleForPublicKey(member.publicKey, environment);
  }

  @ResolveField(() => [Realm], {
    description: 'A list of realms the user follows',
  })
  followedRealms(
    @Root() user: User,
    @CurrentUser() currentUser: UserModel | null,
    @CurrentEnvironment() environment: Environment,
  ) {
    if (!currentUser) {
      throw new errors.Unauthorized();
    }

    if (!user.publicKey.equals(currentUser.publicKey)) {
      throw new errors.Unauthorized();
    }

    return this.realmService.listFollowedRealms(currentUser, environment);
  }

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
