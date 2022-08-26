import { ObjectType, Field, ID } from '@nestjs/graphql';

import { RichTextDocumentScalar } from '@lib/scalars/RichTextDocument';
import { RichTextDocument } from '@lib/types/RichTextDocument';

@ObjectType({
  description: 'A post in a Realm',
})
export class RealmPost {
  @Field(() => Date, {
    description: 'Creation timestamp',
  })
  created: Date;

  @Field(() => RichTextDocumentScalar, {
    description: 'Post body text',
  })
  document: RichTextDocument;

  @Field(() => ID, {
    description: 'A unique identifier for the post',
  })
  id: string;

  @Field(() => String, {
    description: 'Title for the post',
  })
  title: string;

  @Field(() => Date, {
    description: 'Update timestamp',
  })
  updated: Date;
}
