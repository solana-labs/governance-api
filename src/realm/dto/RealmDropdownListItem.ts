import { ObjectType, Field } from '@nestjs/graphql';
import { PublicKey } from '@solana/web3.js';

import { PublicKeyScalar } from '@src/lib/scalars/PublicKey';

@ObjectType({
  description: 'An item in a dropdown list of Realms',
})
export class RealmDropdownListItem {
  @Field({
    description: "Url for the Realm's icon",
    nullable: true,
  })
  iconUrl?: string;

  @Field({
    description: 'Name of the Realm',
  })
  name: string;

  @Field(() => PublicKeyScalar, {
    description: 'Public Key address for the Realm',
  })
  publicKey: PublicKey;
}
