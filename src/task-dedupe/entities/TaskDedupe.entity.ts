import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity()
export class TaskDedupe {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'jsonb',
    nullable: true,
  })
  result?: any;

  @Column()
  key: string;

  @CreateDateColumn()
  created: Date;

  @UpdateDateColumn()
  updated: Date;
}
