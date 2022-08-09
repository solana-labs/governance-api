import { UseGuards } from '@nestjs/common';
import { Resolver, Query } from '@nestjs/graphql';

import { AuthJwtGuard } from '@src/auth/auth.jwt.guard';
import { CurrentUser } from '@src/lib/decorators/CurrentUser';

import { User } from './dto/User';
import { UserService } from './user.service';

@Resolver(() => User)
export class UserResolver {
  constructor(private readonly userService: UserService) {}

  @Query(() => User, {
    description: 'The user making the request, as determined by the jwt token used',
  })
  @UseGuards(AuthJwtGuard)
  me(@CurrentUser() user: User): User {
    return user;
  }
}
