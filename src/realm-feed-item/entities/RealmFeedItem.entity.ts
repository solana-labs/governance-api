import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  OneToMany,
} from 'typeorm';

import { RealmFeedItemType } from '../dto/RealmFeedItemType';
import { Environment } from '@lib/types/Environment';
import { RealmFeedItemComment } from '@src/realm-feed-item-comment/entities/RealmFeedItemComment.entity';

export interface Data {
  type: RealmFeedItemType;
  ref: string;
}

export interface Metadata {
  relevanceScore: number;
  topAllTimeScore: number;
  rawScore: number;
}

@Entity()
export class RealmFeedItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('jsonb')
  data: Data;

  @Column('varchar')
  environment: Environment;

  @Column('jsonb')
  metadata: Metadata;

  @Column()
  realmPublicKeyStr: string;

  @Column('varchar', { array: true, nullable: true })
  crosspostedRealms?: null | string[];

  @OneToMany('RealmFeedItemComment', 'feedItem')
  comments: RealmFeedItemComment[];

  @CreateDateColumn()
  created: Date;

  @DeleteDateColumn()
  deleted: Date;

  @Column('timestamptz')
  updated: Date;
}
