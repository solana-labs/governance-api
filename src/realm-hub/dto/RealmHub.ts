import { Field, ObjectType } from '@nestjs/graphql';
import { PublicKey } from '@solana/web3.js';

import { PublicKeyScalar } from '@src/lib/scalars/PublicKey';

@ObjectType({
  description: 'A hub for a Realm',
})
export class RealmHub {
  @Field(() => PublicKeyScalar, {
    description: 'The realm the hub belongs to',
  })
  realm: PublicKey;
}
