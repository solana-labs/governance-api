import { InputType, Field } from '@nestjs/graphql';

import { RealmCategory } from '../dto/RealmCategory';
import { RichTextDocumentScalar } from '@lib/scalars/RichTextDocument';
import { RichTextDocument } from '@lib/types/RichTextDocument';

import { RealmAboutSectionInput } from './RealmAboutSectionInput';
import { RealmDocumentationInput } from './RealmDocumentationInput';
import { RealmFaqItemInput } from './RealmFaqItemInput';
import { RealmGalleryItemInput } from './RealmGalleryItemInput';
import { RealmResourceInput } from './RealmResourceInput';
import { RealmRoadmapInput } from './RealmRoadmapInput';
import { RealmTeamMemberInput } from './RealmTeamMemberInput';
import { RealmTokenDetailsInput } from './RealmTokenDetailsInput';

@InputType({
  description: 'An input for Realm fields',
})
export class RealmInput {
  @Field(() => [RealmAboutSectionInput], {
    description: 'Long form text describing the Realm',
  })
  about: RealmAboutSectionInput[];

  @Field({
    description: "Url for the Realm's banner",
    nullable: true,
  })
  bannerImageUrl?: string;

  @Field(() => RealmCategory, {
    description: 'Indicates what type of Realm this is',
  })
  category: RealmCategory;

  @Field({
    description: 'Discord link',
    nullable: true,
  })
  discordUrl?: string;

  @Field({
    description: 'The display name of the org',
  })
  displayName: string;

  @Field(() => RealmDocumentationInput, {
    description: 'Optional documentation for the Realm',
    nullable: true,
  })
  documentation?: RealmDocumentationInput;

  @Field(() => [RealmFaqItemInput], {
    description: 'Frequently asked questions in the Realm',
  })
  faq: RealmFaqItemInput[];

  @Field(() => [RealmGalleryItemInput], {
    description: 'A list of items in the gallery',
  })
  gallery: RealmGalleryItemInput[];

  @Field({
    description: 'Github link',
    nullable: true,
  })
  githubUrl?: string;

  @Field(() => RichTextDocumentScalar, {
    description: 'An optional tagline or heading for the Realm',
    nullable: true,
  })
  heading?: RichTextDocument;

  @Field({
    description: "Url for the Realm's icon",
    nullable: true,
  })
  iconUrl?: string;

  @Field({
    description: 'Instagram url',
    nullable: true,
  })
  instagramUrl?: string;

  @Field({
    description: 'LinkedIn url',
    nullable: true,
  })
  linkedInUrl?: string;

  @Field(() => [RealmResourceInput], {
    description: 'A list of external resources relevant to the Realm',
  })
  resources: RealmResourceInput[];

  @Field(() => RealmRoadmapInput, {
    description: 'A roadmap for the Realm',
  })
  roadmap: RealmRoadmapInput;

  @Field({
    description: 'A short text description of the Realm',
    nullable: true,
  })
  shortDescription?: string;

  @Field({
    description: 'Symbol for the Realm',
    nullable: true,
  })
  symbol?: string;

  @Field(() => [RealmTeamMemberInput], {
    description: 'A list of highlighted team members',
  })
  team: RealmTeamMemberInput[];

  @Field(() => RealmTokenDetailsInput, {
    description: 'Optional associated token',
    nullable: true,
  })
  token?: RealmTokenDetailsInput;

  @Field({
    description: 'Twitter handle for the Realm',
    nullable: true,
  })
  twitterHandle?: string;

  @Field({
    description: 'Website url for the Realm',
    nullable: true,
  })
  websiteUrl?: string;
}
