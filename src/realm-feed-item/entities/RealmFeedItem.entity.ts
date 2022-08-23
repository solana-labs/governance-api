import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { RealmFeedItemType } from '../dto/RealmFeedItemType';
import { Environment } from '@lib/types/Environment';

export interface Data {
  type: RealmFeedItemType;
  ref: string;
}

export interface Metadata {
  relevanceScore: number;
  topScore: number;
  rawScore: number;
}

@Entity()
export class RealmFeedItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('jsonb')
  data: Data;

  @Column('varchar')
  environment: Environment;

  @Column('jsonb')
  metadata: Metadata;

  @Column()
  realmPublicKeyStr: string;

  @CreateDateColumn()
  created: Date;

  @DeleteDateColumn()
  deleted: Date;

  @Column('date')
  updated: Date;
}
