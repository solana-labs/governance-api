import { ObjectType, Field } from '@nestjs/graphql';
import { PublicKey } from '@solana/web3.js';

import { PublicKeyScalar } from '@src/lib/scalars/PublicKey';

@ObjectType({
  description: 'A user',
})
export class User {
  @Field(() => PublicKeyScalar, { description: "The user's public key" })
  publicKey: PublicKey;
}
