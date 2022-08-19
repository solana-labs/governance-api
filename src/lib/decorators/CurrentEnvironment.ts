import type { ExecutionContext } from '@nestjs/common';
import { createParamDecorator } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

import { Environment } from '@lib/types/Environment';

export const CurrentEnvironment = createParamDecorator(
  (data: unknown, context: ExecutionContext) => {
    const ctx = GqlExecutionContext.create(context);
    const environment = ctx.getContext().req?.headers?.['x-environment'];

    if (environment === 'devnet') {
      return 'devnet';
    }

    return 'mainnet';
  },
);

export { Environment }
