import { Field, ObjectType } from '@nestjs/graphql';

import { RichTextDocumentScalar } from '@src/lib/scalars/RichTextDocument';
import { RichTextDocument } from '@src/lib/types/RichTextDocument';

import { RealmHubInfoRoadmapItem } from './RealmHubInfoRoadmapItem';

@ObjectType({
  description: 'The roadmap for a Realm',
})
export class RealmHubInfoRoadmap {
  @Field(() => RichTextDocumentScalar, {
    description: 'An optional description for the roadmap',
    nullable: true,
  })
  description?: RichTextDocument;

  @Field(() => [RealmHubInfoRoadmapItem], {
    description: 'The items on the roadmap',
  })
  items: RealmHubInfoRoadmapItem[];
}
