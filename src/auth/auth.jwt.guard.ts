import type { ExecutionContext } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';

import type { User } from '@src/user/entities/User.entity';

/**
 * Requires that the user is authenticated
 */
@Injectable()
export class AuthJwtGuard extends AuthGuard('authJwt') {
  getRequest(context: ExecutionContext) {
    const ctx = GqlExecutionContext.create(context);
    return ctx.getContext().req;
  }
}

/**
 * Does not enforce auth. Merely injects the user into the request context.
 */
@Injectable()
export class JwtGuard extends AuthGuard('authJwt') {
  canActivate() {
    return true;
  }

  getRequest(context: ExecutionContext) {
    const ctx = GqlExecutionContext.create(context);
    return ctx.getContext().req;
  }
}

export interface GuardedReq extends Request {
  user: User;
}
