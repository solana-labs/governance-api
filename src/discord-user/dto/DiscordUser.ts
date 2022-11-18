import { ObjectType, Field } from '@nestjs/graphql';
import { PublicKey } from '@solana/web3.js';

import { PublicKeyScalar } from '@src/lib/scalars/PublicKey';

@ObjectType({
  description: 'A Discord user',
})
export class DiscordUser {
  @Field(() => PublicKeyScalar, { description: 'Public key' })
  publicKey: PublicKey;
}

@ObjectType({
  description: "A Discord user's refresh token",
})
export class RefreshToken {
  @Field({ description: 'Public key' })
  token: string;
}
