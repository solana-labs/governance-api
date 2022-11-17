import { Field, ObjectType } from '@nestjs/graphql';

import { RichTextDocumentScalar } from '@src/lib/scalars/RichTextDocument';
import { RichTextDocument } from '@src/lib/types/RichTextDocument';

@ObjectType({
  description: 'A project team member highlighted in the Hub of a Realm',
})
export class RealmHubInfoTeamMember {
  @Field({
    description: 'An optional url pointing to an avatar for the team member',
    nullable: true,
  })
  avatar?: string;

  @Field(() => RichTextDocumentScalar, {
    description: 'Optional text describing the team member',
    nullable: true,
  })
  description?: RichTextDocument;

  @Field({
    description: "The team member's name",
  })
  name: string;

  @Field({
    description: "An optional title for the member's role",
    nullable: true,
  })
  role?: string;

  @Field({
    description: "The team member's twitter handle",
    nullable: true,
  })
  twitter?: string;
}
