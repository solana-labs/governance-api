import { Resolver, Query, Mutation, Args, ResolveField, Root, Int } from '@nestjs/graphql';
import { PublicKey } from '@solana/web3.js';
import * as EI from 'fp-ts/Either';

import { CurrentEnvironment, Environment } from '@lib/decorators/CurrentEnvironment';
import { CurrentUser, User } from '@lib/decorators/CurrentUser';
import * as errors from '@lib/errors/gql';
import { ClippedRichTextDocument } from '@lib/gqlTypes/ClippedRichTextDocument';
import { ConnectionArgs } from '@lib/gqlTypes/Connection';
import { abbreviateAddress } from '@lib/textManipulation/abbreviateAddress';
import { clipRichTextDocument } from '@lib/textManipulation/clipRichTextDocument';
import { wait } from '@lib/wait';
import { EitherResolver } from '@src/lib/decorators/EitherResolver';
import { PublicKeyScalar } from '@src/lib/scalars/PublicKey';
import { RealmFeedItemSort, RealmFeedItemConnection } from '@src/realm-feed-item/dto/pagination';
import { RealmFeedItem } from '@src/realm-feed-item/dto/RealmFeedItem';
import {
  RealmFeedItemGQLService,
  RealmFeedItemCursor,
} from '@src/realm-feed-item/realm-feed-item.gql.service';
import { RealmFeedItemService } from '@src/realm-feed-item/realm-feed-item.service';
import { GovernanceRules } from '@src/realm-governance/dto/GovernanceRules';
import { RealmGovernanceService } from '@src/realm-governance/realm-governance.service';
import { RealmHubService } from '@src/realm-hub/realm-hub.service';
import { RealmMemberSort, RealmMemberConnection } from '@src/realm-member/dto/pagination';
import { RealmMemberService, RealmMemberCursor } from '@src/realm-member/realm-member.service';
import { RealmProposalSort, RealmProposalConnection } from '@src/realm-proposal/dto/pagination';
import {
  RealmProposalGQLService,
  RealmProposalCursor,
} from '@src/realm-proposal/realm-proposal.gql.service';
import { RealmTreasury } from '@src/realm-treasury/dto/RealmTreasury';
import { RealmTreasuryService } from '@src/realm-treasury/realm-treasury.service';
import { User as UserDto } from '@src/user/dto/User';

import { Realm } from './dto/Realm';
import { RealmFaqItem } from './dto/RealmFaqItem';
import { RealmTeamMember } from './dto/RealmTeamMember';
import { RealmTokenDetails } from './dto/RealmTokenDetails';
import { RealmInput } from './inputDto/RealmInput';
import { RealmService } from './realm.service';

@Resolver(() => Realm)
export class RealmResolver {
  constructor(
    private readonly realmFeedItemGQLService: RealmFeedItemGQLService,
    private readonly realmFeedItemService: RealmFeedItemService,
    private readonly realmGovernanceService: RealmGovernanceService,
    private readonly realmHubService: RealmHubService,
    private readonly realmMemberService: RealmMemberService,
    private readonly realmProposalGqlService: RealmProposalGQLService,
    private readonly realmService: RealmService,
  ) {}

  @ResolveField(() => Boolean, {
    description: 'If the requesting user is an admin of the Realm',
  })
  amAdmin(
    @Root() realm: Realm,
    @CurrentEnvironment() environment: Environment,
    @CurrentUser() user: User | null,
  ) {
    if (!user) {
      return false;
    }

    return this.realmService.userIsCouncilMember(realm.publicKey, user.publicKey, environment);
  }

  @ResolveField(() => ClippedRichTextDocument, {
    description: 'A clipped heading',
    nullable: true,
  })
  clippedHeading(
    @Root() hub: Realm,
    @Args('charLimit', {
      type: () => Int,
      description: 'The character count to clip the document at',
      nullable: true,
      defaultValue: 400,
    })
    charLimit = 400,
    @Args('attachmentLimit', {
      type: () => Int,
      description: 'The maximum number of attachments to include',
      nullable: true,
      defaultValue: 0,
    })
    attachmentLimit = 0,
  ) {
    return hub.heading
      ? clipRichTextDocument(hub.heading, charLimit, attachmentLimit)
      : hub.heading;
  }

  @ResolveField(() => RealmFeedItemConnection, {
    description: 'Realm feed',
  })
  @EitherResolver()
  feed(
    @Args() args: ConnectionArgs,
    @Args('sort', {
      type: () => RealmFeedItemSort,
      description: 'Sort order for the feed',
      defaultValue: RealmFeedItemSort.Relevance,
      nullable: true,
    })
    sort: RealmFeedItemSort = RealmFeedItemSort.Relevance,
    @Root() realm: Realm,
    @CurrentEnvironment() environment: Environment,
    @CurrentUser() user: User | null,
  ) {
    return this.realmFeedItemGQLService.getGQLFeedItemsList(
      realm.publicKey,
      user,
      sort,
      environment,
      args.after as RealmFeedItemCursor | undefined,
      args.before as RealmFeedItemCursor | undefined,
      args.first,
      args.last,
    );
  }

  @ResolveField(() => GovernanceRules, {
    description: 'A governance in a Realm',
  })
  async governance(
    @Args('governance', {
      type: () => PublicKeyScalar,
      description: 'The address of the governance',
    })
    governance: PublicKey,
    @Root() realm: Realm,
    @CurrentEnvironment() environment: Environment,
  ) {
    if (!realm.programPublicKey) {
      throw new errors.MalformedData();
    }

    return this.realmGovernanceService.getGovernanceRules(
      realm.programPublicKey,
      governance,
      environment,
    );
  }

  @ResolveField(() => [RealmFeedItem], {
    description: 'A list of pinned feed items',
  })
  pinnedFeedItems(
    @Root() realm: Realm,
    @CurrentEnvironment() environment: Environment,
    @CurrentUser() user: User | null,
  ) {
    return this.realmFeedItemService.getPinnedFeedItems(realm.publicKey, user, environment);
  }

  @ResolveField(() => RealmMemberConnection, {
    description: 'List of members in the realm',
  })
  @EitherResolver()
  members(
    @Args() args: ConnectionArgs,
    @Args('sort', {
      type: () => RealmMemberSort,
      description: 'Sort order for the list',
      defaultValue: RealmMemberSort.Alphabetical,
      nullable: true,
    })
    sort: RealmMemberSort = RealmMemberSort.Alphabetical,
    @Root() realm: Realm,
    @CurrentEnvironment() environment: Environment,
  ) {
    return this.realmMemberService.getGQLMemberList(
      realm.publicKey,
      sort,
      environment,
      args.after as RealmMemberCursor | undefined,
      args.before as RealmMemberCursor | undefined,
      args.first,
      args.last,
    );
  }

  @ResolveField(() => Int, {
    description: 'Count of the number of members in this Realm',
  })
  membersCount(@Root() realm: Realm, @CurrentEnvironment() environment: Environment) {
    return this.realmMemberService.getMembersCountForRealm(realm.publicKey, environment);
  }

  @ResolveField(() => RealmProposalConnection, {
    description: 'List of proposals in the realm',
  })
  @EitherResolver()
  proposals(
    @Args() args: ConnectionArgs,
    @Args('sort', {
      type: () => RealmProposalSort,
      description: 'Sort order for the list',
      defaultValue: RealmProposalSort.Time,
      nullable: true,
    })
    sort: RealmProposalSort = RealmProposalSort.Time,
    @Root() realm: Realm,
    @CurrentEnvironment() environment: Environment,
    @CurrentUser() user: User | null,
  ) {
    return this.realmProposalGqlService.getGQLProposalList(
      realm.publicKey,
      user ? user.publicKey : null,
      sort,
      environment,
      args.after as RealmProposalCursor | undefined,
      args.before as RealmProposalCursor | undefined,
      args.first,
      args.last,
    );
  }

  @ResolveField(() => RealmTreasury, {
    description: "The realm's treasury",
  })
  treasury(@Root() realm: Realm) {
    return { belongsTo: realm.publicKey };
  }

  @ResolveField(() => Int, {
    description: 'Number of twitter followers',
  })
  twitterFollowerCount(@Root() realm: Realm, @CurrentEnvironment() environment: Environment) {
    return this.realmHubService.getTwitterFollowerCount(realm.publicKey, environment);
  }

  @Query(() => Boolean, {
    description: 'Determines if a Realm can be assigned a given symbol',
  })
  canAssignSymbolToRealm(
    @Args('realm', {
      description: 'The public key of the Realm',
      type: () => PublicKeyScalar,
    })
    realm: PublicKey,
    @Args('symbol', {
      description: 'The symbol to check',
      type: () => String,
    })
    symbol: string,
  ) {
    return this.realmService.newSymbolIsValid(realm, symbol);
  }

  @Query(() => Realm, {
    description: 'A Realm',
  })
  realm(
    @Args('publicKey', {
      description: 'The public key of the Realm',
      type: () => PublicKeyScalar,
    })
    publicKey: PublicKey,
    @CurrentEnvironment() environment: Environment,
  ) {
    return this.realmService.getRealm(publicKey, environment);
  }

  @Query(() => Realm, {
    description: 'A Realm (by its `urlId`)',
  })
  realmByUrlId(
    @Args('urlId', {
      description: 'The id of the Realm as represented in the url',
      type: () => String,
    })
    id: string,
    @CurrentEnvironment() environment: Environment,
  ) {
    return this.realmService.getRealmByUrlId(id, environment);
  }

  @Query(() => [Realm], {
    description: 'A list of Realms to display in a dropdown',
  })
  realmDropdownList(@CurrentEnvironment() environment: Environment) {
    return this.realmService.getRealmDropdownList(environment);
  }

  @Mutation(() => UserDto, {
    description: 'Follow a Realm',
  })
  followRealm(
    @Args('publicKey', {
      description: 'The public key of the Realm',
      type: () => PublicKeyScalar,
    })
    realm: PublicKey,
    @CurrentEnvironment()
    environment: Environment,
    @CurrentUser() user: User | null,
  ) {
    if (!user) {
      throw new errors.Unauthorized();
    }

    return this.realmService.followRealm(realm, user, environment);
  }

  @Mutation(() => UserDto, {
    description: 'Unfollow a Realm',
  })
  unfollowRealm(
    @Args('publicKey', {
      description: 'The public key of the Realm',
      type: () => PublicKeyScalar,
    })
    realm: PublicKey,
    @CurrentEnvironment()
    environment: Environment,
    @CurrentUser() user: User | null,
  ) {
    if (!user) {
      throw new errors.Unauthorized();
    }

    return this.realmService.unfollowRealm(realm, user, environment);
  }

  @Mutation(() => Realm, {
    description: 'Update realm metadata',
  })
  updateRealmMetadata(
    @Args('publicKey', {
      description: 'The public key of the Realm',
      type: () => PublicKeyScalar,
    })
    publicKey: PublicKey,
    @Args('realm', {
      description: 'The new Realm metadata',
      type: () => RealmInput,
    })
    realm: RealmInput,
    @CurrentEnvironment()
    environment: Environment,
    @CurrentUser() user: User | null,
  ) {
    if (!user) {
      throw new errors.Unauthorized();
    }

    return this.realmService.updateRealm(user, publicKey, environment, realm);
  }
}

@Resolver(() => RealmFaqItem)
export class RealmFaqItemResolver {
  @ResolveField(() => ClippedRichTextDocument, {
    description: 'A clipped answer to a FAQ item question',
  })
  clippedAnswer(
    @Root() faqItem: RealmFaqItem,
    @Args('charLimit', {
      type: () => Int,
      description: 'The character count to clip the document at',
      nullable: true,
      defaultValue: 400,
    })
    charLimit = 400,
    @Args('attachmentLimit', {
      type: () => Int,
      description: 'The maximum number of attachments to include',
      nullable: true,
      defaultValue: 0,
    })
    attachmentLimit = 0,
  ) {
    return clipRichTextDocument(faqItem.answer, charLimit, attachmentLimit);
  }
}

@Resolver(() => RealmTokenDetails)
export class RealmTokenDetailsResolver {
  constructor(private readonly realmTreasuryService: RealmTreasuryService) {}

  @ResolveField(() => Number, {
    description: 'Current price of the token',
  })
  async price(@Root() token: RealmTokenDetails, @CurrentEnvironment() environment: Environment) {
    const price = await Promise.race([
      this.realmTreasuryService.getTokenPrice(token.mint, environment)(),
      wait(2000),
    ]).catch(() => 0);

    if (typeof price === 'boolean') {
      return 0;
    }

    if (typeof price === 'number') {
      return price;
    }

    if (EI.isLeft(price)) {
      throw price.left;
    }

    return price.right;
  }

  @ResolveField(() => String, {
    description: 'Symbol for the token',
  })
  async symbol(@Root() token: RealmTokenDetails, @CurrentEnvironment() environment: Environment) {
    const allTokens = await this.realmTreasuryService.fetchTokenListDict(environment)();

    if (EI.isLeft(allTokens)) {
      throw allTokens.left;
    }

    const tokenDetails = allTokens.right[token.mint.toBase58()];
    return tokenDetails?.symbol || abbreviateAddress(token.mint);
  }
}

@Resolver(() => RealmTeamMember)
export class RealmTeamMemberResolver {
  constructor(private readonly realmHubService: RealmHubService) {}

  @ResolveField(() => Int, {
    description: 'Number of twitter followers',
  })
  twitterFollowerCount(@Root() member: RealmTeamMember) {
    if (member.twitter) {
      return this.realmHubService.getTwitterFollowerCountForHandle(member.twitter);
    }

    return 0;
  }
}
