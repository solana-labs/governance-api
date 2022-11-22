import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

import { RealmCategory } from '../dto/RealmCategory';
import { RealmRoadmapItemStatus } from '../dto/RealmRoadmapItemStatus';
import { Environment } from '@lib/types/Environment';
import { RichTextDocument } from '@lib/types/RichTextDocument';

export interface Data {
  about: {
    heading?: string;
    content: RichTextDocument;
  }[];
  bannerImageUrl?: string;
  category: RealmCategory;
  discordUrl?: string;
  displayName: string;
  documentation?: {
    title?: string;
    url: string;
  };
  faq: {
    answer: RichTextDocument;
    question: string;
  }[];
  gallery: {
    caption: string;
    height: number;
    width: number;
    url: string;
  }[];
  githubUrl?: string;
  heading?: RichTextDocument;
  iconUrl?: string;
  instagramUrl?: string;
  linkedInUrl?: string;
  name: string;
  programPublicKeyStr?: string;
  roadmap: {
    description?: RichTextDocument;
    items: {
      date?: number;
      resource?: {
        content?: RichTextDocument;
        title: string;
        url: string;
      };
      status?: RealmRoadmapItemStatus;
      title: string;
    }[];
  };
  resources: {
    title: string;
    content?: RichTextDocument;
    url: string;
  }[];
  shortDescription?: string;
  team: {
    avatarUrl?: string;
    description?: RichTextDocument;
    linkedInHandle?: string;
    name: string;
    role?: string;
    twitterHandle?: string;
  }[];
  token?: {
    mintPublicKeyStr: string;
  };
  twitterHandle?: string;
  websiteUrl?: string;
}

@Entity()
@Unique(['publicKeyStr'])
@Unique(['symbol'])
export class Realm {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('jsonb')
  data: Data;

  @Column('varchar')
  environment: Environment;

  @Column()
  publicKeyStr: string;

  @Column('varchar', { nullable: true })
  symbol?: string;

  @CreateDateColumn()
  created: Date;

  @DeleteDateColumn()
  deleted: Date;

  @UpdateDateColumn()
  updated: Date;
}
