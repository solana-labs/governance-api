import { ObjectType, Field } from '@nestjs/graphql';

import { RealmFeedItem } from '@src/realm-feed-item/dto/RealmFeedItem';
import { Realm } from '@src/realm/dto/Realm';

import { DiscoverPageSpotlightItem } from './DiscoverPageSpotlightItem';

@ObjectType({
  description: 'Discover page information',
})
export class DiscoverPage {
  @Field({
    description: 'The version number for the Discover page',
  })
  version: number;

  @Field(() => [Realm], {
    description: 'Notable orgs in DAO Tooling',
  })
  daoTooling: Realm[];

  @Field(() => [Realm], {
    description: 'Notable orgs in DeFi',
  })
  defi: Realm[];

  @Field(() => [Realm], {
    description: 'Notable orgs in Gaming',
  })
  gaming: Realm[];

  @Field(() => [Realm], {
    description: 'Orgs that won the Hackathon',
  })
  hackathonWinners: Realm[];

  @Field(() => [RealmFeedItem], {
    description: 'A list of key announcement feed items',
  })
  keyAnnouncements: typeof RealmFeedItem[];

  @Field(() => [Realm], {
    description: 'Notable NFT Collection orgs',
  })
  nftCollections: Realm[];

  @Field(() => [Realm], {
    description: 'Popular orgs',
  })
  popular: Realm[];

  @Field(() => [DiscoverPageSpotlightItem], {
    description: 'A list of orgs to display in the spotlight',
  })
  spotlight: DiscoverPageSpotlightItem[];

  @Field(() => [Realm], {
    description: 'Orgs that are trending',
  })
  trending: Realm[];

  @Field(() => [Realm], {
    description: 'Notable orgs in Web3',
  })
  web3: Realm[];
}
