import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType({
  description: 'An item in the gallery',
})
export class RealmHubInfoGalleryItem {
  @Field({
    description: 'An optional caption for the item',
    nullable: true,
  })
  caption: string;

  @Field({
    description: 'The height of the item',
  })
  height: number;

  @Field({
    description: 'The width of the item',
  })
  width: number;

  @Field({
    description: 'A url for the item',
  })
  url: string;
}
