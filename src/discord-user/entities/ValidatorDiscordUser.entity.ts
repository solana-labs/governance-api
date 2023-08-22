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
  key: process.env.REFRESH_TOKEN_SECRET || '',
  algorithm: 'aes-256-gcm',
  ivLength: 16,
};

export interface Data {}

@Entity('validator_discord_user')
@Unique(['authId'])
export class ValidatorDiscordUser {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  authId: string;

  @Column()
  publicKeyStr: string;

  @Column(
  // {
  //   type: 'varchar',
  //   nullable: false,
  //   transformer: new EncryptionTransformer(ENCRYPTION_CONFIG),
  // }
  // getting some encryption error here
  )
  refreshToken: string;

  @CreateDateColumn()
  created: Date;

  @DeleteDateColumn()
  deleted: Date;

  @UpdateDateColumn()
  updated: Date;
}
