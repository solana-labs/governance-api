import { Field, ObjectType } from '@nestjs/graphql';

import { RealmResource } from './RealmResource';
import { RealmRoadmapItemStatus } from './RealmRoadmapItemStatus';

@ObjectType({
  description: "An item in a Realm's roadmap",
})
export class RealmRoadmapItem {
  @Field({
    description: 'When the roadmap item is expected to be completed',
    nullable: true,
  })
  date?: number;

  @Field(() => RealmResource, {
    description: 'An associated external resource for the item',
    nullable: true,
  })
  resource?: RealmResource;

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
