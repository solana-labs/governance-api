import { InputType, Field } from '@nestjs/graphql';

@InputType({
  description: 'Discover page spotlight item',
})
export class DiscoverPageSpotlightItemStatInput {
  @Field({
    description: 'The value to display for the stat',
  })
  value: string;

  @Field({
    description: 'A label for the stat',
  })
  label: string;
}
