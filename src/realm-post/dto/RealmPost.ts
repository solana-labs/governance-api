import { ObjectType, Field, ID } from '@nestjs/graphql';

import { RichTextDocumentScalar } from '@lib/scalars/RichTextDocument';
import { RichTextDocument } from '@lib/types/RichTextDocument';
import { RealmMember } from '@src/realm-member/dto/RealmMember';

@ObjectType({
  description: 'A post in a Realm',
})
export class RealmPost {
  @Field(() => RealmMember, {
    description: 'The creator of the post',
  })
  author: RealmMember;

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
