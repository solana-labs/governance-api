import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { EncryptionTransformer } from 'typeorm-encrypted';

export const ENCRYPTION_CONFIG = {
  key: process.env.MATCHDAY_REFRESH_TOKEN_SECRET!,
  algorithm: 'aes-256-gcm',
  ivLength: 16,
};

export interface Data {}

@Entity()
@Unique(['authId'])
export class MatchdayDiscordUser {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  authId: string;

  @Column()
  publicKeyStr: string;

  @Column({
    type: 'varchar',
    nullable: false,
    transformer: new EncryptionTransformer(ENCRYPTION_CONFIG),
  })
  refreshToken: string;

  @CreateDateColumn()
  created: Date;

  @DeleteDateColumn()
  deleted: Date;

  @UpdateDateColumn()
  updated: Date;
}
