import { Field, InputType } from '@nestjs/graphql';

@InputType({
  description: 'Documentation for the Realm',
})
export class RealmDocumentationInput {
  @Field({
    description: 'A label for the documentation',
    nullable: true,
  })
  title?: string;

  @Field({
    description: 'Where the documentation can be found',
  })
  url: string;
}
