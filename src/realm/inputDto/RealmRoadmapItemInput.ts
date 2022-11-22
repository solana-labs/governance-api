import { Field, InputType } from '@nestjs/graphql';

import { RealmRoadmapItemStatus } from '../dto/RealmRoadmapItemStatus';

import { RealmResourceInput } from './RealmResourceInput';

@InputType({
  description: "An item in a Realm's roadmap",
})
export class RealmRoadmapItemInput {
  @Field({
    description: 'When the roadmap item is expected to be completed',
    nullable: true,
  })
  date?: number;

  @Field(() => RealmResourceInput, {
    description: 'An associated external resource for the item',
    nullable: true,
  })
  resource?: RealmResourceInput;

  @Field(() => RealmRoadmapItemStatus, {
    description: 'The current status of the roadmap item',
    nullable: true,
  })
  status?: RealmRoadmapItemStatus;

  @Field({
    description: 'A label for the item',
  })
  title: string;
}
