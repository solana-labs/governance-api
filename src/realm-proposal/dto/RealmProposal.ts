import { ObjectType, Field } from '@nestjs/graphql';
import { PublicKey } from '@solana/web3.js';

import { PublicKeyScalar } from '@src/lib/scalars/PublicKey';

@ObjectType({
  description: 'A proposal in a Realm',
})
export class RealmProposal {
  @Field(() => PublicKeyScalar, {
    description: 'Public Key address for the proposal',
  })
  publicKey: PublicKey;
}
