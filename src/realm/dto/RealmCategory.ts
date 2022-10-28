import { registerEnumType } from '@nestjs/graphql';

/**
 * A descriptor that indicates the type of the Realm
 */
export enum RealmCategory {
  DAOTools = 'DAOTools',
  Defi = 'Defi',
  Gaming = 'Gaming',
  Nft = 'Nft',
  Web3 = 'Web3',
  Other = 'Other',
}

registerEnumType(RealmCategory, {
  name: 'RealmCategory',
  description: 'A descriptor that indicates the type of the Realm',
  valuesMap: {
    [RealmCategory.DAOTools]: {
      description: 'A Realm that builds tooling for DAOs',
    },
    [RealmCategory.Defi]: {
      description: 'A Realm that operates in the DeFi space',
    },
    [RealmCategory.Gaming]: {
      description: 'A Realm that builds games',
    },
    [RealmCategory.Nft]: {
      description: 'A Realm that operates an NFT Collection',
    },
    [RealmCategory.Web3]: {
      description: 'A Realm that builds web3 tech',
    },
    [RealmCategory.Other]: {
      description: 'A Realm that does not fit into any other category',
    },
  },
});
