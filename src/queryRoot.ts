import { Resolver, Query } from '@nestjs/graphql';

import { PublicKeyScalar } from '@lib/scalars/PublicKey';

@Resolver()
export class QueryRoot {
  @Query(() => PublicKeyScalar, { nullable: true })
  root() {
    return null;
  }
}
