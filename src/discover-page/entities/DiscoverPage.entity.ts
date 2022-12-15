import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Environment } from '@lib/types/Environment';

export interface Data {
  daoToolingPublicKeyStrs: string[];
  defiPublicKeyStrs: string[];
  gamingPublicKeyStrs: string[];
  hackathonWinnersPublicKeyStrs: string[];
  keyAnnouncementFeedItemIds: number[];
  nftCollectionsPublicKeyStrs: string[];
  popularPublicKeyStrs: string[];
  spotlight: {
    heroImageUrl: string;
    title: string;
    realmPublicKeyStr: string;
    description: string;
    stats: {
      value: string;
      label: string;
    }[];
  }[];
  trendingOrgPublicKeyStrs: string[];
  web3PublicKeyStrs: string[];
}

@Entity()
export class DiscoverPage {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('jsonb')
  data: Data;

  @Column('varchar')
  environment: Environment;

  @CreateDateColumn()
  created: Date;

  @DeleteDateColumn()
  deleted: Date;

  @UpdateDateColumn()
  updated: Date;
}
