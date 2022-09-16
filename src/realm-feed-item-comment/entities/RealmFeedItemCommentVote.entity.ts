import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

import { RealmFeedItemCommentVoteType } from '../dto/RealmFeedItemCommentVoteType';

export interface Data {
  type: RealmFeedItemCommentVoteType;
  relevanceWeight: number;
}

@Entity()
export class RealmFeedItemCommentVote {
  @PrimaryColumn()
  commentId: number;

  @PrimaryColumn('uuid')
  userId: string;

  @PrimaryColumn()
  realmPublicKeyStr: string;

  @Column('jsonb')
  data: Data;

  @CreateDateColumn()
  created: Date;

  @DeleteDateColumn()
  deleted: Date;

  @UpdateDateColumn()
  updated: Date;
}
