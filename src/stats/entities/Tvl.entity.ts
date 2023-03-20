import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export interface Data {
  ownTokens: {
    [mintAddress: string]: string;
  };
  tvl: {
    [mintAddress: string]: string;
  };
}

@Entity()
export class Tvl {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('jsonb')
  data: Data;

  @CreateDateColumn()
  created: Date;

  @Column('boolean')
  pending: boolean;

  @DeleteDateColumn()
  deleted: Date;

  @UpdateDateColumn()
  updated: Date;
}
