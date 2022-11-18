import { ObjectType, Field } from '@nestjs/graphql';

@ObjectType({
  description: 'Status of refreshing the Discord metadata',
})
export class RefreshMetadata {
  @Field({ description: 'Status of the refresh' })
  status: string;
}
