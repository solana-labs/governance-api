import { Field, ObjectType } from '@nestjs/graphql';

import { RichTextDocumentScalar } from '@src/lib/scalars/RichTextDocument';
import { RichTextDocument } from '@src/lib/types/RichTextDocument';

@ObjectType({
  description: 'A single FAQ item in the Realm Hub',
})
export class RealmHubInfoFaqItem {
  @Field(() => RichTextDocumentScalar, {
    description: 'The answer to a FAQ item question',
  })
  answer: RichTextDocument;

  @Field({
    description: 'The question being asked in the FAQ item',
  })
  question: string;
}
