import type { ExecutionContext } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';

import type { User } from '@src/user/entities/User.entity';

@Injectable()
export class AuthJwtGuard extends AuthGuard('authJwt') {
  getRequest(context: ExecutionContext) {
    const ctx = GqlExecutionContext.create(context);
    return ctx.getContext().req;
  }
}

export interface GuardedReq extends Request {
  user: User;
}
