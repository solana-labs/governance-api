import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PublicKey } from '@solana/web3.js';
import { compareDesc, differenceInHours, isEqual } from 'date-fns';
import * as AR from 'fp-ts/Array';
import * as FN from 'fp-ts/function';
import * as TE from 'fp-ts/TaskEither';
import { In, Repository } from 'typeorm';

import { User } from '@lib/decorators/CurrentUser';
import * as errors from '@lib/errors/gql';
import { exists } from '@lib/typeGuards/exists';
import { Environment } from '@lib/types/Environment';
import { RichTextDocument } from '@lib/types/RichTextDocument';
import { RealmPostService } from '@src/realm-post/realm-post.service';
import { RealmProposalState } from '@src/realm-proposal/dto/RealmProposalState';
import { RealmProposalService } from '@src/realm-proposal/realm-proposal.service';
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
  constructor(
    @InjectRepository(RealmFeedItemEntity)
    private readonly realmFeedItemRepository: Repository<RealmFeedItemEntity>,
    @InjectRepository(RealmFeedItemVoteEntity)
    private readonly realmFeedItemVoteRepository: Repository<RealmFeedItemVoteEntity>,
    private readonly realmPostService: RealmPostService,
    private readonly realmProposalService: RealmProposalService,
    private readonly taskDedupeService: TaskDedupeService,
  ) {}

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
  createPost(
    realmPublicKey: PublicKey,
    title: string,
    document: RichTextDocument,
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
      this.realmPostService.createPost(
        realmPublicKey,
        title,
        document,
        requestingUser,
        environment,
      ),
      TE.chainW((post) =>
        FN.pipe(
          this.realmFeedItemRepository.create({
            data: {
              type: RealmFeedItemType.Post,
              ref: post.id,
            },
            environment,
            metadata: {
              relevanceScore: 0,
              topAllTimeScore: 0,
              rawScore: 0,
            },
            realmPublicKeyStr: realmPublicKey.toBase58(),
            updated: new Date(),
          }),
          (entity) =>
            TE.tryCatch(
              () => this.realmFeedItemRepository.save(entity),
              (e) => new errors.Exception(e),
            ),
          TE.map(
            (feedItemEntity) =>
              ({
                post,
                type: RealmFeedItemType.Post,
                author: post.author,
                created: feedItemEntity.created,
                document: post.document,
                id: feedItemEntity.id,
                score: feedItemEntity.metadata.rawScore,
                title: post.title,
                updated: feedItemEntity.updated,
              } as RealmFeedItemPost),
          ),
        ),
      ),
    );
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
   * Returns a list of pinned feed items
   */
  getPinnedFeedItems(
    realmPublicKey: PublicKey,
    requestingUser: User | null,
    environment: Environment,
  ) {
    if (environment === 'devnet') {
      return TE.left(new errors.UnsupportedDevnet());
    }

    return FN.pipe(
      this.syncProposalsToFeedItems(realmPublicKey, environment),
      TE.chainW(() => this.realmProposalService.getProposalsForRealm(realmPublicKey, environment)),
      TE.map((proposals) => proposals.slice()),
      TE.map(
        AR.filter(
          (proposal) =>
            proposal.state === RealmProposalState.Voting ||
            proposal.state === RealmProposalState.Executable,
        ),
      ),
      TE.map((proposals) =>
        proposals.sort((a, b) => {
          const aScore = a.state === RealmProposalState.Voting ? 20 : 10;
          const bScore = b.state === RealmProposalState.Voting ? 20 : 10;

          if (aScore === bScore) {
            return compareDesc(a.updated, b.updated);
          } else {
            return bScore - aScore;
          }
        }),
      ),
      TE.chainW((proposals) =>
        TE.sequenceArray(
          proposals.map((proposal) =>
            TE.tryCatch(
              () =>
                this.realmFeedItemRepository
                  .createQueryBuilder('feedItem')
                  .where(`"feedItem"."data"->'type' = :type`, {
                    type: JSON.stringify(RealmFeedItemType.Proposal),
                  })
                  .andWhere(`"feedItem"."data"->'ref' = :ref`, {
                    ref: JSON.stringify(proposal.publicKey.toBase58()),
                  })
                  .getOne(),
              (e) => new errors.Exception(e),
            ),
          ),
        ),
      ),
      TE.map((entities) => entities.filter(exists)),
      TE.bindTo('entities'),
      TE.bindW('votes', ({ entities }) =>
        this.getFeedItemVotes(
          realmPublicKey,
          entities.map((entity) => entity.id),
          requestingUser ? [requestingUser.id] : [],
          environment,
        ),
      ),
      TE.chainW(({ entities, votes }) =>
        this.convertProposalEntitiesToFeedItems(
          realmPublicKey,
          entities,
          requestingUser,
          votes,
          environment,
        ),
      ),
    );
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
