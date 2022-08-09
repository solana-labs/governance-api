import { ObjectType, Field } from '@nestjs/graphql';
import { PublicKey } from '@solana/web3.js';

import { PublicKeyScalar } from '@src/lib/scalars/PublicKey';

@ObjectType({
  description: 'An authentication claim specific to a public key',
})
export class AuthClaim {
  @Field(() => PublicKeyScalar, { description: 'The public key the claim is for' })
  onBehalfOf: PublicKey;

  @Field(() => String, { description: 'A payload that must be signed and returned to the api' })
  claim: string;
}
