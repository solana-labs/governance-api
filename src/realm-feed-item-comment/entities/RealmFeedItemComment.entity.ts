import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  ManyToOne,
} from 'typeorm';

import { Environment } from '@lib/types/Environment';
import { RichTextDocument } from '@lib/types/RichTextDocument';
import { RealmFeedItem } from '@src/realm-feed-item/entities/RealmFeedItem.entity';
import { User } from '@src/user/entities/User.entity';

export interface Data {
  authorPublicKeyStr?: string;
  document: RichTextDocument;
}

export interface Metadata {
  relevanceScore: number;
  topAllTimeScore: number;
  rawScore: number;
}

@Entity()
export class RealmFeedItemComment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  authorId: string;

  @Column('jsonb')
  data: Data;

  @Column()
  feedItemId: number;

  @Column('varchar')
  environment: Environment;

  @Column('jsonb')
  metadata: Metadata;

  @Column({ nullable: true })
  parentCommentId?: number;

  @Column()
  realmPublicKeyStr: string;

  @ManyToOne('User', 'posts')
  author: User;

  @ManyToOne('RealmFeedItem', 'comments')
  feedItem: RealmFeedItem;

  @CreateDateColumn()
  created: Date;

  @DeleteDateColumn()
  deleted: Date;

  @UpdateDateColumn()
  updated: Date;
}
