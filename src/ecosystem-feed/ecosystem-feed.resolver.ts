import { Args, Resolver, Query } from '@nestjs/graphql';

import { CurrentEnvironment, Environment } from '@lib/decorators/CurrentEnvironment';
import { CurrentUser, User } from '@lib/decorators/CurrentUser';
import { ConnectionArgs } from '@lib/gqlTypes/Connection';
import { RealmFeedItemConnection, RealmFeedItemSort } from '@src/realm-feed-item/dto/pagination';
import { RealmFeedItemCursor } from '@src/realm-feed-item/realm-feed-item.gql.service';

import { EcosystemFeedService } from './ecosystem-feed.service';

@Resolver()
export class EcosystemFeedResolver {
  constructor(private readonly ecosystemFeedService: EcosystemFeedService) {}

  @Query(() => RealmFeedItemConnection, {
    description: 'A feed for the ecosystem view',
  })
  ecosystemFeed(
    @Args() args: ConnectionArgs,
    @Args('sort', {
      type: () => RealmFeedItemSort,
      description: 'Sort order for the feed',
      defaultValue: RealmFeedItemSort.Relevance,
      nullable: true,
    })
    sort: RealmFeedItemSort = RealmFeedItemSort.Relevance,
    @CurrentEnvironment() environment: Environment,
    @CurrentUser() user: User | null,
  ) {
    return this.ecosystemFeedService.getGQLFeedItemsList(
      user,
      sort,
      environment,
      args.after as RealmFeedItemCursor | undefined,
      args.before as RealmFeedItemCursor | undefined,
      args.first,
      args.last,
    );
  }
}
