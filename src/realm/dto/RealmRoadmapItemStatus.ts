import { registerEnumType } from '@nestjs/graphql';

/**
 * A discriminant for differentiating the status of a roadmap item
 */
export enum RealmRoadmapItemStatus {
  Completed = 'Completed',
  Delayed = 'Delayed',
  InProgress = 'InProgress',
  Upcoming = 'Upcoming',
}

registerEnumType(RealmRoadmapItemStatus, {
  name: 'RealmRoadmapItemStatus',
  description: 'A discriminant for differentiating the status of a roadmap item',
});
