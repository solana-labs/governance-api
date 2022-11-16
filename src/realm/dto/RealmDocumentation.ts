import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType({
  description: 'Documentation for the Realm',
})
export class RealmDocumentation {
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
