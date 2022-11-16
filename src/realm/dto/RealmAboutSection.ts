import { Field, ObjectType } from '@nestjs/graphql';

import { RichTextDocumentScalar } from '@src/lib/scalars/RichTextDocument';
import { RichTextDocument } from '@src/lib/types/RichTextDocument';

@ObjectType({
  description: "A single section in a Realm's hub info",
})
export class RealmAboutSection {
  @Field({
    description: 'An optional title for the section',
    nullable: true,
  })
  heading?: string;

  @Field(() => RichTextDocumentScalar, {
    description: 'A rich text document containing the body of the section',
  })
  content: RichTextDocument;
}
