import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Environment } from '@lib/types/Environment';
import { RichTextDocument } from '@lib/types/RichTextDocument';

export interface Data {
  document: RichTextDocument;
  title: string;
}

@Entity()
export class RealmPost {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('jsonb')
  data: Data;

  @Column('varchar')
  environment: Environment;

  @Column()
  realmPublicKeyStr: string;

  @CreateDateColumn()
  created: Date;

  @DeleteDateColumn()
  deleted: Date;

  @UpdateDateColumn()
  updated: Date;
}
