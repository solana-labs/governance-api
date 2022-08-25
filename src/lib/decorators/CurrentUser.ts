import type { ExecutionContext } from '@nestjs/common';
import { createParamDecorator } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import type { PublicKey } from '@solana/web3.js';

import { Data } from '@src/user/entities/User.entity';

export interface User extends Data {
  id: string;
  publicKey: PublicKey;
}

/**
 * Get the current user making the request
 */
export const CurrentUser = createParamDecorator(
  (data: unknown, context: ExecutionContext) => {
    const ctx = GqlExecutionContext.create(context);
    return ctx.getContext().req.user as User;
  },
);

