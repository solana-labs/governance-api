import { Field, ObjectType } from '@nestjs/graphql';
import { PublicKey } from '@solana/web3.js';

import { PublicKeyScalar } from '@lib/scalars/PublicKey';

@ObjectType({
  description: "A realm's treasury",
})
export class RealmTreasury {
  @Field(() => PublicKeyScalar, {
    description: 'The realm the treasury belongs to',
  })
  belongsTo: PublicKey;
}
