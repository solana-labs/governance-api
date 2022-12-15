import { ObjectType, Field } from '@nestjs/graphql';

@ObjectType({
  description: 'Discover page spotlight item',
})
export class DiscoverPageSpotlightItemStat {
  @Field({
    description: 'The value to display for the stat',
  })
  value: string;

  @Field({
    description: 'A label for the stat',
  })
  label: string;
}
