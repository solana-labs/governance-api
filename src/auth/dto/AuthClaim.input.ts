import { InputType, Field } from '@nestjs/graphql';
import { PublicKey } from '@solana/web3.js';

import { NonceScalar } from '@src/lib/scalars/Nonce';
import { PublicKeyScalar } from '@src/lib/scalars/PublicKey';

@InputType({
  description: 'An authentication claim specific to a public key',
})
export class AuthClaimInput {
  @Field(() => PublicKeyScalar, { description: 'The public key the claim is for' })
  onBehalfOf: PublicKey;

  @Field(() => NonceScalar, { description: 'The claim nonce' })
  nonce: string;

  @Field(() => Date, { description: 'When the claim was created' })
  created: Date;
}
