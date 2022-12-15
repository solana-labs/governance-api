import { InputType, Field } from '@nestjs/graphql';
import { PublicKey } from '@solana/web3.js';

import { PublicKeyScalar } from '@lib/scalars/PublicKey';
import { RealmFeedItemIDScalar } from '@src/lib/scalars/RealmFeedItemID';

import { DiscoverPageSpotlightItemInput } from './DiscoverPageSpotlightItemInput';

@InputType({
  description: 'Discover page data',
})
export class DiscoverPageInput {
  @Field(() => [PublicKeyScalar], {
    description: 'Notable DAO tooling orgs',
  })
  daoTooling: PublicKey[];

  @Field(() => [PublicKeyScalar], {
    description: 'Notable DeFi orgs',
  })
  defi: PublicKey[];

  @Field(() => [PublicKeyScalar], {
    description: 'Notable Gaming orgs',
  })
  gaming: PublicKey[];

  @Field(() => [PublicKeyScalar], {
    description: 'Hackathon winners',
  })
  hackathonWinners: PublicKey[];

  @Field(() => [RealmFeedItemIDScalar], {
    description: 'Key announcements',
  })
  keyAnnouncements: number[];

  @Field(() => [PublicKeyScalar], {
    description: 'Notable NFT Collections',
  })
  nftCollections: PublicKey[];

  @Field(() => [PublicKeyScalar], {
    description: 'Popular orgs',
  })
  popular: PublicKey[];

  @Field(() => [DiscoverPageSpotlightItemInput], {
    description: 'Spotlight items',
  })
  spotlight: DiscoverPageSpotlightItemInput[];

  @Field(() => [PublicKeyScalar], {
    description: 'Trending orgs',
  })
  trending: PublicKey[];

  @Field(() => [PublicKeyScalar], {
    description: 'Notable Web3 orgs',
  })
  web3: PublicKey[];
}
