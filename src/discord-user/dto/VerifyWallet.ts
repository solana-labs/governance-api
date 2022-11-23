import { ObjectType, Field } from '@nestjs/graphql';
import { PublicKey } from '@solana/web3.js';

import { PublicKeyScalar } from '@src/lib/scalars/PublicKey';

export enum DiscordApplication {
  SOLANA,
  MATCHDAY,
}

@ObjectType({
  description: 'Status on the wallet verification',
})
export class VerifyWallet {
  @Field(() => PublicKeyScalar, {
    description: 'Status of the connection between the Discord user and the wallet',
  })
  publicKey: PublicKey;

  @Field({ description: 'Which Discord application is this for?' })
  application: DiscordApplication;
}
