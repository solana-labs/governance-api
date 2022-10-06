import { Field, ObjectType } from '@nestjs/graphql';

import { RealmHubInfoResource } from './RealmHubInfoResource';
import { RealmHubInfoRoadmapItemStatus } from './RealmHubInfoRoadmapItemStatus';

@ObjectType({
  description: "An item in a Realm's roadmap",
})
export class RealmHubInfoRoadmapItem {
  @Field({
    description: 'When the roadmap item is expected to be completed',
    nullable: true,
  })
  date: Date;

  @Field(() => RealmHubInfoResource, {
    description: 'An associated external resource for the item',
    nullable: true,
  })
  resource?: RealmHubInfoResource;

  @Field(() => RealmHubInfoRoadmapItemStatus, {
    description: 'The current status of the roadmap item',
    nullable: true,
  })
  status?: RealmHubInfoRoadmapItemStatus;

  @Field({
    description: 'A label for the item',
  })
  title: string;
}
