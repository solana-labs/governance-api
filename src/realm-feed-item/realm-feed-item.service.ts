import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PublicKey } from '@solana/web3.js';
import { compareDesc, differenceInHours, isEqual } from 'date-fns';
import * as EI from 'fp-ts/Either';
import * as FN from 'fp-ts/function';
import * as TE from 'fp-ts/TaskEither';
import { In, Repository } from 'typeorm';

import { User } from '@lib/decorators/CurrentUser';
import * as errors from '@lib/errors/gql';
import { enhanceRichTextDocument } from '@lib/textManipulation/enhanceRichTextDocument';
import { exists } from '@lib/typeGuards/exists';
import { Environment } from '@lib/types/Environment';
import { RichTextDocument } from '@lib/types/RichTextDocument';
import { ConfigService } from '@src/config/config.service';
import { DialectService, DIALECT_NOTIF_TYPE_ID_UPVOTE } from '@src/dialect/dialect.service';
import { RealmMemberService } from '@src/realm-member/realm-member.service';
import { RealmPostService } from '@src/realm-post/realm-post.service';
import { RealmProposalState } from '@src/realm-proposal/dto/RealmProposalState';
import { RealmProposalService } from '@src/realm-proposal/realm-proposal.service';
import { StaleCacheService } from '@src/stale-cache/stale-cache.service';
import { TaskDedupeService } from '@src/task-dedupe/task-dedupe.service';

import { RealmFeedItem, RealmFeedItemPost, RealmFeedItemProposal } from './dto/RealmFeedItem';
import { RealmFeedItemType } from './dto/RealmFeedItemType';
import { RealmFeedItemVoteType } from './dto/RealmFeedItemVoteType';
import { RealmFeedItem as RealmFeedItemEntity } from './entities/RealmFeedItem.entity';
import { RealmFeedItemVote as RealmFeedItemVoteEntity } from './entities/RealmFeedItemVote.entity';

interface UserVoteMapping {
  [feedItem: string]: {
    [userId: string]: RealmFeedItemVoteType;
  };
}

@Injectable()
export class RealmFeedItemService {
  private logger = new Logger(RealmFeedItemService.name);

  constructor(
    @InjectRepository(RealmFeedItemEntity)
    private readonly realmFeedItemRepository: Repository<RealmFeedItemEntity>,
    @InjectRepository(RealmFeedItemVoteEntity)
    private readonly realmFeedItemVoteRepository: Repository<RealmFeedItemVoteEntity>,
    private readonly configService: ConfigService,
    private readonly realmPostService: RealmPostService,
    private readonly realmProposalService: RealmProposalService,
    private readonly realmMemberService: RealmMemberService,
    private readonly staleCacheService: StaleCacheService,
    private readonly taskDedupeService: TaskDedupeService,
    private readonly dialectService: DialectService,
  ) {}

  /**
   * Convert entites belonging to multiple realms to feed items
   */
  async convertMixedFeedEntitiesToFeedItem(
    entities: RealmFeedItemEntity[],
    requestingUser: User | null,
    environment: Environment,
  ) {
    if (environment === 'devnet') {
      throw new errors.UnsupportedDevnet();
    }

    const groups = this.groupEntitesByRealm(entities);
    const realms = Object.keys(groups);
    const feedItemsResp = await Promise.all(
      realms.map((realmPublicKeyStr) => {
        const groupEntities = groups[realmPublicKeyStr];

        return this.convertEntitiesToFeedItems(
          new PublicKey(realmPublicKeyStr),
          groupEntities,
          requestingUser,
          environment,
        )();
      }),
    );

    const feedItems = feedItemsResp.reduce((acc, items) => {
      if (EI.isLeft(items)) {
        return acc;
      }

      return {
        ...acc,
        ...items.right,
      };
    }, {} as { [id: string]: RealmFeedItemPost | RealmFeedItemProposal });

    return feedItems;
  }

  /**
   * Convert raw entities into feed items
   */
  convertEntitiesToFeedItems(
    realmPublicKey: PublicKey,
    entities: RealmFeedItemEntity[],
    requestingUser: User | null,
    environment: Environment,
  ) {
    if (environment === 'devnet') {
      return TE.left(new errors.UnsupportedDevnet());
    }

    return FN.pipe(
      TE.of(this.splitEntitiesIntoTypes(entities)),
      TE.bindTo('entities'),
      TE.bindW('votes', ({ entities }) =>
        this.getFeedItemVotes(
          realmPublicKey,
          entities.posts.concat(entities.proposals).map((entity) => entity.id),
          requestingUser ? [requestingUser.id] : [],
          environment,
        ),
      ),
      TE.bindW('posts', ({ entities, votes }) =>
        this.convertPostEntitiesToFeedItems(
          realmPublicKey,
          entities.posts,
          requestingUser,
          votes,
          environment,
        ),
      ),
      TE.bindW('proposals', ({ entities, votes }) =>
        this.convertProposalEntitiesToFeedItems(
          realmPublicKey,
          entities.proposals,
          requestingUser,
          votes,
          environment,
        ),
      ),
      TE.map(({ posts, proposals }) => this.organizeFeedItemsListIntoMap([...posts, ...proposals])),
    );
  }

  /**
   * Create a new post
   */
  async createPost(args: {
    crosspostTo?: null | PublicKey[];
    document: RichTextDocument;
    environment: Environment;
    realmPublicKey: PublicKey;
    requestingUser: User | null;
    title: string;
  }) {
    if (args.environment === 'devnet') {
      throw new errors.UnsupportedDevnet();
    }

    const requestingUser = args.requestingUser;

    if (!requestingUser) {
      throw new errors.Unauthorized();
    }

    const enhancedDocument = await enhanceRichTextDocument(args.document, {
      twitterBearerToken: this.configService.get('external.twitterBearerKey'),
    });

    const postResp = await this.realmPostService.createPost(
      args.realmPublicKey,
      args.title,
      enhancedDocument,
      requestingUser,
      args.environment,
    )();

    if (EI.isLeft(postResp)) {
      throw postResp.left;
    }

    const post = postResp.right;

    const feedItem = this.realmFeedItemRepository.create({
      data: {
        type: RealmFeedItemType.Post,
        ref: post.id,
      },
      crosspostedRealms: args.crosspostTo ? args.crosspostTo.map((pk) => pk.toBase58()) : null,
      environment: args.environment,
      metadata: {
        relevanceScore: 0,
        topAllTimeScore: 0,
        rawScore: 0,
      },
      realmPublicKeyStr: args.realmPublicKey.toBase58(),
      updated: new Date(),
    });

    await this.realmFeedItemRepository.save(feedItem);

    const feedItemPost: RealmFeedItemPost = {
      post: post,
      type: RealmFeedItemType.Post,
      author: post.author,
      created: feedItem.created,
      document: post.document,
      id: feedItem.id,
      realmPublicKey: args.realmPublicKey,
      score: feedItem.metadata.rawScore,
      title: post.title,
      updated: feedItem.updated,
    };

    return feedItemPost;
  }

  /**
   * Group entities by the realm their in
   */
  groupEntitesByRealm(entities: RealmFeedItemEntity[]) {
    const groups: {
      [realm: string]: RealmFeedItemEntity[];
    } = {};

    for (const entity of entities) {
      if (!groups[entity.realmPublicKeyStr]) {
        groups[entity.realmPublicKeyStr] = [];
      }

      groups[entity.realmPublicKeyStr].push(entity);
    }

    return groups;
  }

  /**
   * Returns a feed item entity
   */
  getFeedItemEntity(
    realmPublicKey: PublicKey,
    id: RealmFeedItemEntity['id'],
    environment: Environment,
  ) {
    if (environment === 'devnet') {
      return TE.left(new errors.UnsupportedDevnet());
    }

    return FN.pipe(
      TE.tryCatch(
        () =>
          this.realmFeedItemRepository.findOne({
            where: { id, realmPublicKeyStr: realmPublicKey.toBase58() },
          }),
        (e) => new errors.Exception(e),
      ),
      TE.chainW(TE.fromNullable(new errors.NotFound())),
    );
  }

  /**
   * Return a single feed item
   */
  getFeedItem(
    realmPublicKey: PublicKey,
    id: RealmFeedItemEntity['id'],
    requestingUser: User | null,
    environment: Environment,
  ) {
    if (environment === 'devnet') {
      return TE.left(new errors.UnsupportedDevnet());
    }

    return FN.pipe(
      this.getFeedItemEntity(realmPublicKey, id, environment),
      TE.bindTo('entity'),
      TE.bindW('votes', ({ entity }) =>
        this.getFeedItemVotes(
          realmPublicKey,
          [entity.id],
          requestingUser ? [requestingUser.id] : [],
          environment,
        ),
      ),
      TE.chainW(({ entity, votes }) =>
        this.convertEntityToFeedItem(realmPublicKey, entity, requestingUser, votes, environment),
      ),
    );
  }

  /**
   * Return a list of feed items
   */
  async getFeedItems(
    ids: RealmFeedItemEntity['id'][],
    requestingUser: User | null,
    environment: Environment,
  ) {
    if (environment === 'devnet') {
      throw new errors.UnsupportedDevnet();
    }

    const items = await this.realmFeedItemRepository.find({ where: { id: In(ids) } });

    const votesResp = await Promise.all(
      items.map((item) =>
        this.getFeedItemVotes(
          new PublicKey(item.realmPublicKeyStr),
          [item.id],
          requestingUser ? [requestingUser.id] : [],
          environment,
        )(),
      ),
    );

    const votes = votesResp.reduce((acc, item) => {
      if (EI.isRight(item)) {
        for (const feedItemId of Object.keys(item.right)) {
          if (!acc[feedItemId]) {
            acc[feedItemId] = {};
          }

          const userVotes = item.right[feedItemId];

          for (const userId of Object.keys(userVotes)) {
            acc[feedItemId][userId] = userVotes[userId];
          }
        }
      }

      return acc;
    }, {} as UserVoteMapping);

    const entitiesResp = await Promise.all(
      items.map((item) =>
        this.convertEntityToFeedItem(
          new PublicKey(item.realmPublicKeyStr),
          item,
          requestingUser,
          votes,
          environment,
        )(),
      ),
    );

    return entitiesResp
      .map((resp) => {
        if (EI.isRight(resp)) {
          return resp.right;
        }

        return null;
      })
      .filter(exists);
  }

  /**
   * Returns a list of pinned feed items
   */
  async getPinnedFeedItems(
    realmPublicKey: PublicKey,
    requestingUser: User | null,
    environment: Environment,
  ) {
    if (environment === 'devnet') {
      throw new errors.UnsupportedDevnet();
    }

    await this.syncProposalsToFeedItems(realmPublicKey, environment)();

    const proposalsResp = await this.realmProposalService.getProposalsForRealm(
      realmPublicKey,
      environment,
    )();

    if (EI.isLeft(proposalsResp)) {
      throw proposalsResp.left;
    }

    const openProposals = proposalsResp.right
      .filter(
        (proposal) =>
          proposal.state === RealmProposalState.Voting ||
          proposal.state === RealmProposalState.Executable,
      )
      .sort((a, b) => {
        const aScore = a.state === RealmProposalState.Voting ? 20 : 10;
        const bScore = b.state === RealmProposalState.Voting ? 20 : 10;

        if (aScore === bScore) {
          return compareDesc(a.updated, b.updated);
        } else {
          return bScore - aScore;
        }
      });

    const entities = (
      await Promise.all(
        openProposals.map((proposal) =>
          this.realmFeedItemRepository
            .createQueryBuilder('feedItem')
            .where(`"feedItem"."data"->'type' = :type`, {
              type: JSON.stringify(RealmFeedItemType.Proposal),
            })
            .andWhere(`"feedItem"."data"->'ref' = :ref`, {
              ref: JSON.stringify(proposal.publicKey.toBase58()),
            })
            .getOne()
            .catch(() => null),
        ),
      )
    ).filter(exists);

    const votesResp = await this.getFeedItemVotes(
      realmPublicKey,
      entities.map((e) => e.id),
      requestingUser ? [requestingUser.id] : [],
      environment,
    )();

    if (EI.isLeft(votesResp)) {
      throw votesResp.left;
    }

    const votes = votesResp.right;

    const feedItemsResp = await this.convertProposalEntitiesToFeedItems(
      realmPublicKey,
      entities,
      requestingUser,
      votes,
      environment,
    )();

    if (EI.isLeft(feedItemsResp)) {
      throw feedItemsResp.left;
    }

    return feedItemsResp.right;
  }

  /**
   * Get a mapping of feed item votes by feed item and user
   */
  getFeedItemVotes(
    realmPublicKey: PublicKey,
    feedItemIds: number[],
    userIds: string[],
    environment: Environment,
  ) {
    if (environment === 'devnet') {
      return TE.left(new errors.UnsupportedDevnet());
    }

    return FN.pipe(
      TE.tryCatch(
        () =>
          this.realmFeedItemVoteRepository.find({
            where: {
              feedItemId: In(feedItemIds),
              userId: In(userIds),
              realmPublicKeyStr: realmPublicKey.toBase58(),
            },
          }),
        (e) => new errors.Exception(e),
      ),
      TE.map((entities) => {
        const mapping: UserVoteMapping = {};

        for (const entity of entities) {
          if (!mapping[entity.feedItemId]) {
            mapping[entity.feedItemId] = {};
          }

          mapping[entity.feedItemId][entity.userId] = entity.data.type;
        }

        return mapping;
      }),
    );
  }

  /**
   * Send a notification when a user gets a certain number of upvotes
   */
  async sendVoteNotification(
    feedItem: RealmFeedItemPost | RealmFeedItemProposal,
    environment: Environment,
  ) {
    const notifKey = this.configService.get('external.dialectNotifKey');

    if (!(feedItem.author && notifKey)) {
      return;
    }

    const authorPublicKey = new PublicKey(feedItem.author.publicKey);
    const numVotes = feedItem.score;
    const handle = await this.realmMemberService.getHandleName(authorPublicKey, environment);

    // TODO verify title / message copy. Possible to add URL to post?
    const title = `👍 New Upvotes!`;
    const message = `${handle}, your ${feedItem.type} now has ${numVotes} upvotes!`;
    const recipient = authorPublicKey.toBase58();

    // send notification
    this.dialectService.sendMessage(title, message, DIALECT_NOTIF_TYPE_ID_UPVOTE, [recipient]);
  }

  /**
   * Ensure that all the proposals are accurately represented as feed items
   */
  syncProposalsToFeedItems(realmPublicKey: PublicKey, environment: Environment) {
    if (environment === 'devnet') {
      return TE.left(new errors.UnsupportedDevnet());
    }

    return this.taskDedupeService.dedupe({
      key: `syncProposalsToFeedItems-${realmPublicKey.toBase58()}-${environment}`,
      ttl: 10 * 1000,
      fn: FN.pipe(
        this.realmProposalService.getProposalAddressesForRealm(realmPublicKey, environment),
        TE.bindTo('proposals'),
        TE.bindW('existingEntities', ({ proposals }) =>
          TE.tryCatch(
            () =>
              proposals.length
                ? this.realmFeedItemRepository
                    .createQueryBuilder('feeditem')
                    .where('feeditem.environment = :env', { env: environment })
                    .andWhere(`"feeditem"."data"->'ref' IN (:...ids)`, {
                      ids: proposals.map((p) => JSON.stringify(p.publicKey.toBase58())),
                    })
                    .andWhere('feeditem.realmPublicKeyStr = :pk', { pk: realmPublicKey.toBase58() })
                    .andWhere(`"feeditem"."data"->'type' = :type`, {
                      type: JSON.stringify(RealmFeedItemType.Proposal),
                    })
                    .getMany()
                : Promise.resolve([]),
            (e) => new errors.Exception(e),
          ),
        ),
        TE.chainW(({ proposals, existingEntities }) => {
          let updateExisting = false;
          const existing = new Set<string>();

          // Ensure that the dates line up
          for (const ent of existingEntities) {
            for (const proposal of proposals) {
              if (ent.data.ref === proposal.publicKey.toBase58()) {
                existing.add(proposal.publicKey.toBase58());

                if (!isEqual(ent.updated, proposal.updated)) {
                  ent.updated = proposal.updated;
                  updateExisting = true;
                }
              }
            }
          }

          const newProposals = proposals.filter(
            (proposal) => !existing.has(proposal.publicKey.toBase58()),
          );

          if (!updateExisting && !newProposals.length) {
            return TE.right([]);
          }

          return TE.tryCatch(
            () =>
              this.realmFeedItemRepository.save([
                ...(updateExisting ? existingEntities : []),
                ...newProposals.map((proposal) =>
                  this.realmFeedItemRepository.create({
                    environment,
                    data: {
                      type: RealmFeedItemType.Proposal,
                      ref: proposal.publicKey.toBase58(),
                    },
                    metadata: {
                      relevanceScore: 0,
                      topAllTimeScore: 0,
                      rawScore: 0,
                    },
                    realmPublicKeyStr: realmPublicKey.toBase58(),
                    updated: proposal.updated,
                  }),
                ),
              ]),
            (e) => new errors.Exception(e),
          );
        }),
        TE.match(
          (e) => {
            this.logger.error(e);
            return [];
          },
          (feedItems) => feedItems,
        ),
        TE.fromTask,
      ),
    });
  }

  /**
   * Approve or disapprove a feed item
   */
  submitVote(
    realmPublicKey: PublicKey,
    id: RealmFeedItemEntity['id'],
    type: RealmFeedItemVoteType,
    requestingUser: User | null,
    environment: Environment,
  ) {
    if (environment === 'devnet') {
      return TE.left(new errors.UnsupportedDevnet());
    }

    if (!requestingUser) {
      return TE.left(new errors.Unauthorized());
    }

    return FN.pipe(
      this.getFeedItemEntity(realmPublicKey, id, environment),
      TE.bindTo('feedItem'),
      TE.bindW('existingVote', ({ feedItem }) =>
        TE.tryCatch(
          () =>
            this.realmFeedItemVoteRepository.findOne({
              where: {
                feedItemId: feedItem.id,
                userId: requestingUser.id,
                realmPublicKeyStr: realmPublicKey.toBase58(),
              },
            }),
          (e) => new errors.Exception(e),
        ),
      ),
      TE.chainW(({ feedItem, existingVote }) => {
        // undo the vote
        if (existingVote && existingVote.data.type === type) {
          const relevanceWeight = existingVote.data.relevanceWeight;

          if (existingVote.data.type === RealmFeedItemVoteType.Approve) {
            feedItem.metadata.relevanceScore -= relevanceWeight;
            feedItem.metadata.rawScore -= 1;
            feedItem.metadata.topAllTimeScore -= 1;
          } else {
            feedItem.metadata.relevanceScore += relevanceWeight;
            feedItem.metadata.rawScore += 1;
            feedItem.metadata.topAllTimeScore += 1;
          }

          return FN.pipe(
            TE.tryCatch(
              () => this.realmFeedItemVoteRepository.remove(existingVote),
              (e) => new errors.Exception(e),
            ),
            TE.chainW(() =>
              TE.tryCatch(
                () => this.realmFeedItemRepository.save(feedItem),
                (e) => new errors.Exception(e),
              ),
            ),
          );
        }
        // change the vote
        else if (existingVote && existingVote.data.type !== type) {
          const relevanceWeight = existingVote.data.relevanceWeight;

          // changing from disapprove to approve
          if (type === RealmFeedItemVoteType.Approve) {
            feedItem.metadata.relevanceScore += 2 * relevanceWeight;
            feedItem.metadata.rawScore += 2;
            feedItem.metadata.topAllTimeScore += 2;
          }
          // change from approve to disapprove
          else {
            feedItem.metadata.relevanceScore -= 2 * relevanceWeight;
            feedItem.metadata.rawScore -= 2;
            feedItem.metadata.topAllTimeScore -= 2;
          }

          existingVote.data.type = type;

          return FN.pipe(
            TE.tryCatch(
              () => this.realmFeedItemVoteRepository.save(existingVote),
              (e) => new errors.Exception(e),
            ),
            TE.chainW(() =>
              TE.tryCatch(
                () => this.realmFeedItemRepository.save(feedItem),
                (e) => new errors.Exception(e),
              ),
            ),
          );
        }
        // submit a new vote
        else {
          const hours = differenceInHours(Date.now(), feedItem.created);
          const relevanceWeight = 1 - Math.min(1, Math.ceil(hours / 4));

          if (type === RealmFeedItemVoteType.Approve) {
            feedItem.metadata.relevanceScore += relevanceWeight;
            feedItem.metadata.rawScore += 1;
            feedItem.metadata.topAllTimeScore += 1;
          } else {
            feedItem.metadata.relevanceScore -= relevanceWeight;
            feedItem.metadata.rawScore -= 1;
            feedItem.metadata.topAllTimeScore -= 1;
          }

          const vote = this.realmFeedItemVoteRepository.create({
            feedItemId: feedItem.id,
            userId: requestingUser.id,
            realmPublicKeyStr: realmPublicKey.toBase58(),
            data: { type, relevanceWeight },
          });

          return FN.pipe(
            TE.tryCatch(
              () => this.realmFeedItemVoteRepository.save(vote),
              (e) => new errors.Exception(e),
            ),
            TE.chainW(() =>
              TE.tryCatch(
                () => this.realmFeedItemRepository.save(feedItem),
                (e) => new errors.Exception(e),
              ),
            ),
          );
        }
      }),
      TE.bindTo('entity'),
      TE.bindW('votes', ({ entity }) =>
        this.getFeedItemVotes(
          realmPublicKey,
          [entity.id],
          requestingUser ? [requestingUser.id] : [],
          environment,
        ),
      ),
      TE.chainW(({ entity, votes }) =>
        this.convertEntityToFeedItem(realmPublicKey, entity, requestingUser, votes, environment),
      ),
      TE.map((feedItem) => {
        this.sendVoteNotification(feedItem, environment);
        return feedItem;
      }),
    );
  }

  /**
   * Convert a single entity into a feed item
   */
  private convertEntityToFeedItem(
    realmPublicKey: PublicKey,
    entity: RealmFeedItemEntity,
    requestingUser: User | null,
    votes: UserVoteMapping,
    environment: Environment,
  ) {
    switch (entity.data.type) {
      case RealmFeedItemType.Post:
        return FN.pipe(
          this.realmPostService.getPostsForRealmByIds(
            realmPublicKey,
            [entity.data.ref],
            requestingUser?.publicKey || null,
            environment,
          ),
          TE.map((mapping) => mapping[entity.data.ref]),
          TE.chainW(TE.fromNullable(new errors.NotFound())),
          TE.map(
            (post) =>
              ({
                post,
                realmPublicKey,
                type: RealmFeedItemType.Post,
                author: post.author,
                created: entity.created,
                document: post.document,
                id: entity.id,
                myVote: requestingUser ? votes[entity.id]?.[requestingUser.id] : undefined,
                score: entity.metadata.rawScore,
                title: post.title,
                updated: entity.updated,
              } as typeof RealmFeedItem),
          ),
        );
      case RealmFeedItemType.Proposal:
        return FN.pipe(
          this.realmProposalService.getProposalForUserByPublicKey(
            new PublicKey(entity.data.ref),
            requestingUser?.publicKey || null,
            environment,
          ),
          TE.map(
            (proposal) =>
              ({
                proposal,
                realmPublicKey,
                type: RealmFeedItemType.Proposal,
                author: proposal.author,
                created: entity.created,
                document: proposal.document,
                id: entity.id,
                myVote: requestingUser ? votes[entity.id]?.[requestingUser.id] : undefined,
                score: entity.metadata.rawScore,
                title: proposal.title,
                updated: entity.updated,
              } as typeof RealmFeedItem),
          ),
        );
    }
  }

  /**
   * Handle post feed item creation
   */
  private convertPostEntitiesToFeedItems(
    realmPublicKey: PublicKey,
    entities: RealmFeedItemEntity[],
    requestingUser: User | null,
    votes: UserVoteMapping,
    environment: Environment,
  ) {
    return FN.pipe(
      this.realmPostService.getPostsForRealmByIds(
        realmPublicKey,
        entities.map((p) => p.data.ref),
        requestingUser?.publicKey || null,
        environment,
      ),
      TE.map((postsMap) =>
        entities.map(
          (post) =>
            ({
              realmPublicKey,
              type: RealmFeedItemType.Post,
              author: postsMap[post.data.ref].author,
              created: post.created,
              document: postsMap[post.data.ref].document,
              id: post.id,
              myVote: requestingUser ? votes[post.id]?.[requestingUser.id] : undefined,
              post: postsMap[post.data.ref],
              score: post.metadata.rawScore,
              title: postsMap[post.data.ref].title,
              updated: post.updated,
            } as RealmFeedItemPost),
        ),
      ),
    );
  }

  /**
   * Handle proposal feed item creation
   */
  private convertProposalEntitiesToFeedItems(
    realmPublicKey: PublicKey,
    entities: RealmFeedItemEntity[],
    requestingUser: User | null,
    votes: UserVoteMapping,
    environment: Environment,
  ) {
    return FN.pipe(
      this.realmProposalService.getProposalsForRealmAndUserByPublicKeys(
        realmPublicKey,
        entities.map((p) => new PublicKey(p.data.ref)),
        requestingUser?.publicKey || null,
        environment,
      ),
      TE.map((proposalMap) =>
        entities
          .map(
            (proposal) =>
              ({
                realmPublicKey,
                type: RealmFeedItemType.Proposal,
                author: proposalMap[proposal.data.ref].author,
                created: proposal.created,
                document: proposalMap[proposal.data.ref].document,
                id: proposal.id,
                myVote: requestingUser ? votes[proposal.id]?.[requestingUser.id] : undefined,
                proposal: proposalMap[proposal.data.ref],
                score: proposal.metadata.rawScore,
                title: proposalMap[proposal.data.ref].title,
                updated: proposal.updated,
              } as RealmFeedItemProposal),
          )
          .filter((proposal) => !!proposal.proposal),
      ),
    );
  }

  /**
   * Turn a list of feed items into a map
   */
  private organizeFeedItemsListIntoMap(feedItems: typeof RealmFeedItem[]) {
    const map: { [id: string]: typeof RealmFeedItem } = {};

    for (const feedItem of feedItems) {
      map[feedItem.id] = feedItem;
    }

    return map;
  }

  /**
   * Splits entities into posts and proposals
   */
  private splitEntitiesIntoTypes(entities: RealmFeedItemEntity[]) {
    return entities.reduce(
      (acc, entity) => {
        if (entity.data.type === RealmFeedItemType.Post) {
          acc.posts.push(entity);
        }

        if (entity.data.type === RealmFeedItemType.Proposal) {
          acc.proposals.push(entity);
        }

        return acc;
      },
      { posts: [], proposals: [] } as {
        posts: RealmFeedItemEntity[];
        proposals: RealmFeedItemEntity[];
      },
    );
  }
}
