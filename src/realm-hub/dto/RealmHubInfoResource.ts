import { Field, ObjectType } from '@nestjs/graphql';

import { RichTextDocumentScalar } from '@src/lib/scalars/RichTextDocument';
import { RichTextDocument } from '@src/lib/types/RichTextDocument';

@ObjectType({
  description: 'An external resource relevant to the Realm',
})
export class RealmHubInfoResource {
  @Field({
    description: 'A label for the resouce',
  })
  title: string;

  @Field(() => RichTextDocumentScalar, {
    description: 'Optional body for the resource',
    nullable: true,
  })
  content?: RichTextDocument;

  @Field({
    description: 'Where the resource can be found',
  })
  url: string;
}
