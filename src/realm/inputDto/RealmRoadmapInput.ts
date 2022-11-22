import { Field, InputType } from '@nestjs/graphql';

import { RichTextDocumentScalar } from '@src/lib/scalars/RichTextDocument';
import { RichTextDocument } from '@src/lib/types/RichTextDocument';

import { RealmRoadmapItemInput } from './RealmRoadmapItemInput';

@InputType({
  description: 'The roadmap for a Realm',
})
export class RealmRoadmapInput {
  @Field(() => RichTextDocumentScalar, {
    description: 'An optional description for the roadmap',
    nullable: true,
  })
  description?: RichTextDocument;

  @Field(() => [RealmRoadmapItemInput], {
    description: 'The items on the roadmap',
  })
  items: RealmRoadmapItemInput[];
}
