import { ObjectType, Field } from '@nestjs/graphql';
import { PublicKey } from '@solana/web3.js';

import { PublicKeyScalar } from '@lib/scalars/PublicKey';

import { DiscoverPageSpotlightItemStat } from './DiscoverPageSpotlightItemStat';

@ObjectType({
  description: 'Discover page spotlight item',
})
export class DiscoverPageSpotlightItem {
  @Field({
    description: 'Hero image for the spotlight',
  })
  heroImageUrl: string;

  @Field({
    description: 'Title',
  })
  title: string;

  @Field(() => PublicKeyScalar, {
    description: 'PublicKey of the realm',
  })
  publicKey: PublicKey;

  @Field({
    description: 'A description for the Spotlight',
  })
  description: string;

  @Field(() => [DiscoverPageSpotlightItemStat], {
    description: 'A list of stats to display',
  })
  stats: DiscoverPageSpotlightItemStat[];
}
