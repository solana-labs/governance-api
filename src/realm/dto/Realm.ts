import { ObjectType, Field } from '@nestjs/graphql';
import { PublicKey } from '@solana/web3.js';

import { PublicKeyScalar } from '@src/lib/scalars/PublicKey';

@ObjectType({
  description: 'A Realm',
})
export class Realm {
  @Field({
    description: 'Name of the Realm',
  })
  name: string;

  @Field(() => PublicKeyScalar, {
    description: 'Public Key address for the Realm',
  })
  publicKey: PublicKey;
}
