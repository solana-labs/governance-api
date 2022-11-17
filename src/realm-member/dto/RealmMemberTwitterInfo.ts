import { ObjectType, Field } from '@nestjs/graphql';

@ObjectType({
  description: 'Connected Twitter info served by Cardinal',
})
export class RealmMemberTwitterInfo {
  @Field(() => String, {
    description: 'URL for the associated twitter avatar',
    nullable: true,
  })
  avatarUrl: string;

  @Field(() => String, {
    description: "User's twitter handle",
  })
  handle: string;
}
