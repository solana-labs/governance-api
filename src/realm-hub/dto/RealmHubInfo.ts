import { Field, ObjectType } from '@nestjs/graphql';

import { RichTextDocumentScalar } from '@src/lib/scalars/RichTextDocument';
import { RichTextDocument } from '@src/lib/types/RichTextDocument';

import { RealmHubInfoAboutSection } from './RealmHubInfoAboutSection';
import { RealmHubInfoDocumentation } from './RealmHubInfoDocumentation';
import { RealmHubInfoFaqItem } from './RealmHubInfoFaqItem';
import { RealmHubInfoGalleryItem } from './RealmHubInfoGalleryItem';
import { RealmHubInfoResource } from './RealmHubInfoResource';
import { RealmHubInfoRoadmap } from './RealmHubInfoRoadmap';
import { RealmHubInfoTeamMember } from './RealmHubInfoTeamMember';
import { RealmHubInfoTokenDetails } from './RealmHubInfoTokenDetails';

@ObjectType({
  description: 'Information about a Realm',
})
export class RealmHubInfo {
  @Field(() => [RealmHubInfoAboutSection], {
    description: 'Long form text describing the Realm',
  })
  about: RealmHubInfoAboutSection[];

  @Field(() => RealmHubInfoDocumentation, {
    description: 'Optional documentation for the Realm',
    nullable: true,
  })
  documentation?: RealmHubInfoDocumentation;

  @Field(() => [RealmHubInfoFaqItem], {
    description: 'Frequently asked questions in the Realm',
  })
  faq: RealmHubInfoFaqItem[];

  @Field(() => [RealmHubInfoGalleryItem], {
    description: 'A list of items in the gallery',
  })
  gallery: RealmHubInfoGalleryItem[];

  @Field(() => RichTextDocumentScalar, {
    description: 'An optional tagline or heading for the Realm',
    nullable: true,
  })
  heading?: RichTextDocument;

  @Field(() => [RealmHubInfoResource], {
    description: 'A list of external resources relevant to the Realm',
  })
  resources: RealmHubInfoResource[];

  @Field(() => RealmHubInfoRoadmap, {
    description: 'A roadmap for the Realm',
  })
  roadmap: RealmHubInfoRoadmap;

  @Field(() => [RealmHubInfoTeamMember], {
    description: 'A list of highlighted team members',
  })
  team: RealmHubInfoTeamMember[];

  @Field(() => RealmHubInfoTokenDetails, {
    description: 'Optional associated token',
    nullable: true,
  })
  token?: RealmHubInfoTokenDetails;
}
