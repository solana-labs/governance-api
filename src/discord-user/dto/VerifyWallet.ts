import { ObjectType, Field, registerEnumType } from '@nestjs/graphql';
import { PublicKey } from '@solana/web3.js';

import { PublicKeyScalar } from '@src/lib/scalars/PublicKey';

export enum DiscordApplication {
  SOLANA,
  MATCHDAY,
}

registerEnumType(DiscordApplication, {
  name: 'DiscordApplication',
});

@ObjectType({
  description: 'Status on the wallet verification',
})
export class VerifyWallet {
  @Field(() => PublicKeyScalar, {
    description: 'Status of the connection between the Discord user and the wallet',
  })
  publicKey: PublicKey;
}
