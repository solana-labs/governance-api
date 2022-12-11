import { Field, ObjectType } from '@nestjs/graphql';

class DiscordData {
  @Field()
  name: string;
}

@ObjectType({
  description: 'The Discord interaction payload',
})
export class DiscordInteractionPayload {
  @Field()
  type: number;

  @Field()
  data: DiscordData;
}
