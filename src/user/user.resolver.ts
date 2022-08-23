import { UseGuards } from '@nestjs/common';
import { Resolver, Query } from '@nestjs/graphql';

import { CurrentEnvironment, Environment } from '@lib/decorators/CurrentEnvironment';
import { CurrentUser } from '@lib/decorators/CurrentUser';
import * as errors from '@lib/errors/gql';
import { AuthJwtGuard } from '@src/auth/auth.jwt.guard';

import { User } from './dto/User';
import { UserService } from './user.service';

@Resolver(() => User)
export class UserResolver {
  constructor(private readonly userService: UserService) {}

  @Query(() => User, {
    description:
      'User making the request, as determined by the jwt bearer token in the authorization header',
    nullable: true,
  })
  @UseGuards(AuthJwtGuard)
  me(@CurrentUser() user: User | null, @CurrentEnvironment() environment: Environment) {
    if (environment === 'devnet') {
      throw new errors.UnsupportedDevnet();
    }

    return user;
  }
}
