import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PublicKey } from '@solana/web3.js';
import { compareDesc, differenceInHours, format } from 'date-fns';
import * as FN from 'fp-ts/function';
import * as TE from 'fp-ts/TaskEither';
import * as IT from 'io-ts';
import { In, Repository } from 'typeorm';

import * as base64 from '@lib/base64';
import { BrandedString } from '@lib/brands';
import { User } from '@lib/decorators/CurrentUser';
import * as errors from '@lib/errors/gql';
import { enhanceRichTextDocument } from '@lib/textManipulation/enhanceRichTextDocument';
import { Environment } from '@lib/types/Environment';
import { ConfigService } from '@src/config/config.service';
import { exists } from '@src/lib/typeGuards/exists';
import { RichTextDocument } from '@src/lib/types/RichTextDocument';
import { RealmFeedItemType } from '@src/realm-feed-item/dto/RealmFeedItemType';
import { RealmFeedItem } from '@src/realm-feed-item/entities/RealmFeedItem.entity';
import { RealmMemberService } from '@src/realm-member/realm-member.service';
import { RealmPost } from '@src/realm-post/entities/RealmPost.entity';

import { RealmFeedItemCommentSort, RealmFeedItemCommentConnection } from './dto/pagination';
import { RealmFeedItemComment } from './dto/RealmFeedItemComment';
import { RealmFeedItemCommentVoteType } from './dto/RealmFeedItemCommentVoteType';
import { RealmFeedItemComment as RealmFeedItemCommentEntity } from './entities/RealmFeedItemComment.entity';
import { RealmFeedItemCommentVote as RealmFeedItemCommentVoteEntity } from './entities/RealmFeedItemCommentVote.entity';

export const RealmFeedItemCommentCursor = BrandedString('realm feed item comment cursor');
export type RealmFeedItemCommentCursor = IT.TypeOf<typeof RealmFeedItemCommentCursor>;

const PAGE_SIZE = 25;

interface UserVoteMapping {
  [feedItem: string]: {
    [userId: string]: RealmFeedItemCommentVoteType;
  };
}

interface CommentTreeData {
  ids: number[];
  map: {
    [commentId: number]: RealmFeedItemCommentEntity;
  };
  replies: {
    [commentId: number]: number[];
  };
}

@Injectable()
export class RealmFeedItemCommentService {
  constructor(
    @InjectRepository(RealmFeedItem)
    private readonly realmFeedItemRepository: Repository<RealmFeedItem>,
    @InjectRepository(RealmFeedItemCommentEntity)
    private readonly realmFeedItemCommentRepository: Repository<RealmFeedItemCommentEntity>,
    @InjectRepository(RealmFeedItemCommentVoteEntity)
    private readonly realmFeedItemCommentVoteRepository: Repository<RealmFeedItemCommentVoteEntity>,
    @InjectRepository(RealmPost)
    private readonly realmPostRepository: Repository<RealmPost>,
    private readonly realmMemberService: RealmMemberService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Add a comment to a feed item
   */
  async createComment(args: {
    document: RichTextDocument;
    environment: Environment;
    feedItemId: number;
    parentCommentId?: number | null;
    realmPublicKey: PublicKey;
    requestingUser?: User | null;
  }) {
    if (args.environment === 'devnet') {
      throw new errors.UnsupportedDevnet();
    }

    const { requestingUser } = args;

    if (!requestingUser) {
      throw new errors.Unauthorized();
    }

    const enhancedDocument = await enhanceRichTextDocument(args.document, {
      twitterBearerToken: this.configService.get('external.twitterBearerKey'),
    });

    const comment = this.realmFeedItemCommentRepository.create({
      authorId: requestingUser.id,
      data: {
        authorPublicKeyStr: requestingUser.publicKey.toBase58(),
        document: enhancedDocument,
      },
      environment: args.environment,
      feedItemId: args.feedItemId,
      metadata: { relevanceScore: 0, topAllTimeScore: 0, rawScore: 0 },
      parentCommentId: args.parentCommentId || undefined,
      realmPublicKeyStr: args.realmPublicKey.toBase58(),
    });

    const entity = await this.realmFeedItemCommentRepository.save(comment);

    this.sendReplyNotification(entity, args.environment);

    return this.convertEntityToComment({
      entity,
      environment: args.environment,
      requestingUser: args.requestingUser,
      votes: { [entity.id]: {} },
    });
  }

  /**
   * Get a count of comments for a feed item
   */
  getCommentCountForFeedItem(args: { environment: Environment; feedItemId: number }) {
    if (args.environment === 'devnet') {
      return TE.left(new errors.UnsupportedDevnet());
    }

    return TE.tryCatch(
      () =>
        this.realmFeedItemCommentRepository.count({
          where: { feedItemId: args.feedItemId },
        }),
      (e) => new errors.Exception(e),
    );
  }

  /**
   * Get a comment entity from the db
   */
  getCommentEntity(args: { environment: Environment; id: RealmFeedItemCommentEntity['id'] }) {
    return FN.pipe(
      TE.tryCatch(
        () =>
          this.realmFeedItemCommentRepository.findOne({
            where: {
              id: args.id,
              environment: args.environment,
            },
          }),
        (e) => new errors.Exception(e),
      ),
      TE.chainW((entity) => {
        if (entity) {
          return TE.right(entity);
        }

        return TE.left(new errors.NotFound());
      }),
    );
  }

  /**
   * Get a comment tree for a another comment
   */
  getCommentTreeForComment(args: {
    commentId: number;
    depth: number;
    environment: Environment;
    feedItemId: number;
    requestingUser?: User | null;
    sort: RealmFeedItemCommentSort;
  }) {
    return FN.pipe(
      this.getCommentEntity({ environment: args.environment, id: args.commentId }),
      TE.bindTo('entity'),
      TE.bindW('commentTreeData', ({ entity }) =>
        this.getCommentTree({
          commentIds: [entity.id],
          currentDepth: 1,
          currentTree: { map: {}, replies: {}, ids: [] },
          environment: args.environment,
          feedItemId: args.feedItemId,
          requestingUser: args.requestingUser,
          sort: args.sort,
          targetDepth: args.depth,
        }),
      ),
      TE.bindW('userVotes', ({ commentTreeData, entity }) =>
        this.getCommentVotes({
          commentIds: [entity.id].concat(commentTreeData.ids),
          feedItemId: args.feedItemId,
          userIds: args.requestingUser ? [args.requestingUser.id] : [],
          environment: args.environment,
        }),
      ),
      TE.map(({ commentTreeData, entity, userVotes }) =>
        this.buildTree({
          entity,
          currentDepth: 1,
          environment: args.environment,
          requestingUser: args.requestingUser,
          targetDepth: args.depth,
          tree: commentTreeData,
          votes: userVotes,
        }),
      ),
    );
  }

  /**
   * Get a comment tree for a feed item
   */
  getCommentTreeForFeedItem(args: {
    after?: RealmFeedItemCommentCursor;
    before?: RealmFeedItemCommentCursor;
    depth: number;
    environment: Environment;
    feedItemId: number;
    first?: number;
    last?: number;
    requestingUser?: User | null;
    sort: RealmFeedItemCommentSort;
  }) {
    return FN.pipe(
      this.getTopLevelComments(args),
      TE.bindTo('topLevelComments'),
      TE.bindW('commentTreeData', ({ topLevelComments }) =>
        this.getCommentTree({
          commentIds: topLevelComments.map((comment) => comment.id),
          currentDepth: 1,
          currentTree: { map: {}, replies: {}, ids: [] },
          environment: args.environment,
          feedItemId: args.feedItemId,
          requestingUser: args.requestingUser,
          sort: args.sort,
          targetDepth: args.depth,
        }),
      ),
      TE.bindW('userVotes', ({ commentTreeData, topLevelComments }) =>
        this.getCommentVotes({
          commentIds: commentTreeData.ids.concat(topLevelComments.map((c) => c.id)),
          feedItemId: args.feedItemId,
          userIds: args.requestingUser ? [args.requestingUser.id] : [],
          environment: args.environment,
        }),
      ),
      TE.map(({ commentTreeData, topLevelComments, userVotes }) =>
        topLevelComments.map((entity) => ({
          node: this.buildTree({
            entity,
            currentDepth: 1,
            environment: args.environment,
            requestingUser: args.requestingUser,
            targetDepth: args.depth,
            tree: commentTreeData,
            votes: userVotes,
          }),
          cursor: this.toCursor(entity, args.sort),
        })),
      ),
      TE.chainW((edges) => {
        if (args.first) {
          return TE.right({
            edges,
            pageInfo: {
              hasNextPage: edges.length > 0,
              hasPreviousPage: false,
              startCursor: null,
              endCursor: edges[edges.length - 1]?.cursor,
            },
          } as RealmFeedItemCommentConnection);
        }

        if (args.last) {
          return TE.right({
            edges,
            pageInfo: {
              hasNextPage: false,
              hasPreviousPage: edges.length > 0,
              startCursor: edges[0]?.cursor,
              endCursor: null,
            },
          } as RealmFeedItemCommentConnection);
        }

        if (args.after) {
          return TE.right({
            edges,
            pageInfo: {
              hasNextPage: edges.length > 0,
              hasPreviousPage: true,
              startCursor: args.after,
              endCursor: edges[edges.length - 1]?.cursor,
            },
          } as RealmFeedItemCommentConnection);
        }

        if (args.before) {
          return TE.right({
            edges,
            pageInfo: {
              hasNextPage: true,
              hasPreviousPage: edges.length > 0,
              startCursor: edges[0]?.cursor,
              endCursor: args.before,
            },
          } as RealmFeedItemCommentConnection);
        }

        return TE.left(new errors.MalformedRequest());
      }),
    );
  }

  /**
   * Get a mapping of comment votes by comment and user
   */
  getCommentVotes(args: {
    commentIds: number[];
    feedItemId: number;
    userIds: string[];
    environment: Environment;
  }) {
    if (args.environment === 'devnet') {
      return TE.left(new errors.UnsupportedDevnet());
    }

    return FN.pipe(
      TE.tryCatch(
        () =>
          this.realmFeedItemCommentVoteRepository.find({
            where: {
              commentId: In(args.commentIds),
              userId: In(args.userIds),
            },
          }),
        (e) => new errors.Exception(e),
      ),
      TE.map((entities) => {
        const mapping: UserVoteMapping = {};

        for (const entity of entities) {
          if (!mapping[entity.commentId]) {
            mapping[entity.commentId] = {};
          }

          mapping[entity.commentId][entity.userId] = entity.data.type;
        }

        return mapping;
      }),
    );
  }

  /**
   * Send a notification when a user receives a reply to their post or comment
   */
  async sendReplyNotification(comment: RealmFeedItemCommentEntity, environment: Environment) {
    const notifKey = this.configService.get('external.dialectNotifKey');
    let parentAuthorPublicKey: PublicKey | null = null;
    let parentType: 'post' | 'comment' | null = null;

    if (comment.parentCommentId) {
      const parentComment = await this.realmFeedItemCommentRepository.findOne({
        where: { id: comment.parentCommentId },
        relations: ['author'],
      });

      if (parentComment?.author) {
        parentAuthorPublicKey = new PublicKey(parentComment.author.publicKeyStr);
        parentType = 'comment';
      }
    } else {
      const parentFeedItem = await this.realmFeedItemRepository.findOne({
        where: { id: comment.feedItemId },
      });

      if (parentFeedItem?.data.type === RealmFeedItemType.Post) {
        const parentPost = await this.realmPostRepository.findOne({
          where: { id: parentFeedItem.data.ref },
          relations: ['author'],
        });

        if (parentPost) {
          parentAuthorPublicKey = new PublicKey(parentPost.author.publicKeyStr);
          parentType = 'post';
        }
      }
    }

    if (parentAuthorPublicKey && parentType && notifKey) {
      const handle = await this.realmMemberService.getHandleName(
        parentAuthorPublicKey,
        environment,
      );

      // send notification
    }
  }

  /**
   * Send a notification when a user gets a certain number of upvotes
   */
  async sendVoteNotification(comment: RealmFeedItemComment, environment: Environment) {
    const notifKey = this.configService.get('external.dialectNotifKey');

    if (!(comment.author && notifKey)) {
      return;
    }

    const authorPublicKey = new PublicKey(comment.author.publicKey);
    const numVotes = comment.score;
    const handle = await this.realmMemberService.getHandleName(authorPublicKey, environment);

    // send notification
  }

  /**
   * Approve or disapprove a comment
   */
  submitVote(args: {
    realmPublicKey: PublicKey;
    id: RealmFeedItemCommentEntity['id'];
    type: RealmFeedItemCommentVoteType;
    requestingUser?: User | null;
    environment: Environment;
  }) {
    if (args.environment === 'devnet') {
      return TE.left(new errors.UnsupportedDevnet());
    }

    if (!args.requestingUser) {
      return TE.left(new errors.Unauthorized());
    }

    const requestingUser = args.requestingUser;
    const userId = requestingUser.id;

    return FN.pipe(
      this.getCommentEntity({
        environment: args.environment,
        id: args.id,
      }),
      TE.bindTo('comment'),
      TE.bindW('existingVote', ({ comment }) =>
        TE.tryCatch(
          () =>
            this.realmFeedItemCommentVoteRepository.findOne({
              where: {
                userId,
                commentId: comment.id,
                realmPublicKeyStr: args.realmPublicKey.toBase58(),
              },
            }),
          (e) => new errors.Exception(e),
        ),
      ),
      TE.bindW('userVoteMap', ({ comment, existingVote }) => {
        // undo the vote
        if (existingVote && existingVote.data.type === args.type) {
          const relevanceWeight = existingVote.data.relevanceWeight;

          if (existingVote.data.type === RealmFeedItemCommentVoteType.Approve) {
            comment.metadata.relevanceScore -= relevanceWeight;
            comment.metadata.rawScore -= 1;
            comment.metadata.topAllTimeScore -= 1;
          } else {
            comment.metadata.relevanceScore += relevanceWeight;
            comment.metadata.rawScore += 1;
            comment.metadata.topAllTimeScore += 1;
          }

          return FN.pipe(
            TE.tryCatch(
              () => this.realmFeedItemCommentVoteRepository.remove(existingVote),
              (e) => new errors.Exception(e),
            ),
            TE.chainW(() =>
              TE.tryCatch(
                () => this.realmFeedItemCommentRepository.save(comment),
                (e) => new errors.Exception(e),
              ),
            ),
            TE.map(
              () =>
                ({
                  [comment.id]: {},
                } as UserVoteMapping),
            ),
          );
        }
        // change the vote
        else if (existingVote && existingVote.data.type !== args.type) {
          const relevanceWeight = existingVote.data.relevanceWeight;

          // changing from disapprove to approve
          if (args.type === RealmFeedItemCommentVoteType.Approve) {
            comment.metadata.relevanceScore += 2 * relevanceWeight;
            comment.metadata.rawScore += 2;
            comment.metadata.topAllTimeScore += 2;
          }
          // change from approve to disapprove
          else {
            comment.metadata.relevanceScore -= 2 * relevanceWeight;
            comment.metadata.rawScore -= 2;
            comment.metadata.topAllTimeScore -= 2;
          }

          existingVote.data.type = args.type;

          return FN.pipe(
            TE.tryCatch(
              () => this.realmFeedItemCommentVoteRepository.save(existingVote),
              (e) => new errors.Exception(e),
            ),
            TE.chainW(() =>
              TE.tryCatch(
                () => this.realmFeedItemCommentRepository.save(comment),
                (e) => new errors.Exception(e),
              ),
            ),
            TE.map(() => ({
              [comment.id]: {
                [userId]: args.type,
              },
            })),
          );
        }
        // submit a new vote
        else {
          const hours = differenceInHours(Date.now(), comment.created);
          const relevanceWeight =
            1 - Math.min(1, Math.ceil(hours / this.configService.get('constants.voteDecay')));

          if (args.type === RealmFeedItemCommentVoteType.Approve) {
            comment.metadata.relevanceScore += relevanceWeight;
            comment.metadata.rawScore += 1;
            comment.metadata.topAllTimeScore += 1;
          } else {
            comment.metadata.relevanceScore -= relevanceWeight;
            comment.metadata.rawScore -= 1;
            comment.metadata.topAllTimeScore -= 1;
          }

          const vote = this.realmFeedItemCommentVoteRepository.create({
            userId,
            commentId: comment.id,
            realmPublicKeyStr: args.realmPublicKey.toBase58(),
            data: { relevanceWeight, type: args.type },
          });

          return FN.pipe(
            TE.tryCatch(
              () => this.realmFeedItemCommentVoteRepository.save(vote),
              (e) => new errors.Exception(e),
            ),
            TE.chainW(() =>
              TE.tryCatch(
                () => this.realmFeedItemCommentRepository.save(comment),
                (e) => new errors.Exception(e),
              ),
            ),
            TE.map(() => ({
              [comment.id]: {
                [userId]: args.type,
              },
            })),
          );
        }
      }),
      TE.bindW('replies', ({ comment }) =>
        this.getCommentReplies({
          commentIds: [comment.id],
          environment: args.environment,
          feedItemId: comment.feedItemId,
          sort: RealmFeedItemCommentSort.Relevance,
          requestingUser: args.requestingUser,
        }),
      ),
      TE.map(({ comment, replies, userVoteMap }) => ({
        ...this.convertEntityToComment({
          requestingUser,
          entity: comment,
          environment: args.environment,
          votes: userVoteMap,
        }),
        repliesCount: replies.replies[comment.id]?.length || 0,
      })),
      TE.map((comment) => {
        this.sendVoteNotification(comment, args.environment);
        return comment;
      }),
    );
  }

  /**
   * Create a cursor
   */
  toCursor(feedItem: RealmFeedItemCommentEntity, sortOrder: RealmFeedItemCommentSort) {
    let id: string;

    switch (sortOrder) {
      case RealmFeedItemCommentSort.New: {
        id = feedItem.updated.getTime().toString();
        break;
      }
      case RealmFeedItemCommentSort.Relevance: {
        const updatedAsNumber = parseInt(format(feedItem.updated, 'yyyyMMddHHmm'), 10);
        const score = feedItem.metadata.relevanceScore + updatedAsNumber / 10;
        id = score.toString();
        break;
      }
      case RealmFeedItemCommentSort.TopAllTime: {
        id = feedItem.metadata.topAllTimeScore.toString();
        break;
      }
    }

    return base64.encode(
      JSON.stringify({
        sortOrder,
        feedItem: id,
      }),
    ) as RealmFeedItemCommentCursor;
  }

  /**
   * Convert a cursor into properties
   */
  fromCursor(cursor: RealmFeedItemCommentCursor) {
    const decoded = base64.decode(cursor);
    const parsed = JSON.parse(decoded);
    const sortOrder = parsed.sortOrder as RealmFeedItemCommentSort;

    switch (sortOrder) {
      case RealmFeedItemCommentSort.New:
        return {
          sortOrder,
          feedItem: new Date(parseInt(parsed.feedItem, 10)),
        };
      case RealmFeedItemCommentSort.Relevance:
        return {
          sortOrder,
          feedItem: parseFloat(parsed.feedItem),
        };
      case RealmFeedItemCommentSort.TopAllTime:
        return {
          sortOrder,
          feedItem: parseFloat(parsed.feedItem),
        };
    }
  }

  private buildTree(args: {
    currentDepth: number;
    entity: RealmFeedItemCommentEntity;
    environment: Environment;
    requestingUser?: User | null;
    targetDepth: number;
    tree: CommentTreeData;
    votes: UserVoteMapping;
  }) {
    const comment = this.convertEntityToComment({
      entity: args.entity,
      environment: args.environment,
      requestingUser: args.requestingUser,
      votes: args.votes,
    });

    if (args.tree.replies[args.entity.id]?.length) {
      if (args.currentDepth < args.targetDepth) {
        const replies = args.tree.replies[args.entity.id]
          .map((id) => args.tree.map[id])
          .filter(exists)
          .map((entity) =>
            this.buildTree({
              entity,
              currentDepth: args.currentDepth + 1,
              environment: args.environment,
              requestingUser: args.requestingUser,
              targetDepth: args.targetDepth,
              tree: args.tree,
              votes: args.votes,
            }),
          );

        comment.replies = replies;
      }

      comment.repliesCount = args.tree.replies[args.entity.id].length;
    } else {
      comment.repliesCount = 0;
    }

    return comment;
  }

  private convertEntityToComment(args: {
    entity: RealmFeedItemCommentEntity;
    environment: Environment;
    requestingUser?: User | null;
    votes: UserVoteMapping;
  }): RealmFeedItemComment {
    const myVote = args.requestingUser
      ? args.votes[args.entity.id]?.[args.requestingUser.id]
      : undefined;

    return {
      myVote,
      author: args.entity.data.authorPublicKeyStr
        ? { publicKey: new PublicKey(args.entity.data.authorPublicKeyStr) }
        : undefined,
      created: args.entity.created,
      document: args.entity.data.document,
      feedItemId: args.entity.feedItemId,
      id: args.entity.id,
      parentCommentId: args.entity.parentCommentId,
      repliesCount: 0,
      replies: null,
      score: args.entity.metadata.rawScore,
      updated: args.entity.updated,
    };
  }

  private getCommentReplies(args: {
    commentIds: number[];
    environment: Environment;
    feedItemId: number;
    requestingUser?: User | null;
    sort: RealmFeedItemCommentSort;
  }) {
    return FN.pipe(
      TE.tryCatch(
        () =>
          args.commentIds.length
            ? this.realmFeedItemCommentRepository
                .createQueryBuilder('comment')
                .where('comment.environment = :env', { env: args.environment })
                .andWhere('comment.parentCommentId IN (:...ids)', { ids: args.commentIds })
                .andWhere('comment.feedItemId = :feedItemId', { feedItemId: args.feedItemId })
                .orderBy(this.orderByClause('comment', args.sort))
                .getMany()
            : Promise.resolve([]),
        (e) => new errors.Exception(e),
      ),
      TE.bindTo('entities'),
      TE.bindW('map', ({ entities }) =>
        TE.right(
          entities.reduce((acc, item) => {
            acc[item.id] = item;

            return acc;
          }, {} as { [commentId: number]: RealmFeedItemCommentEntity }),
        ),
      ),
      TE.bindW('replies', ({ entities }) =>
        TE.right(
          entities.reduce((acc, item) => {
            if (item.parentCommentId) {
              if (!acc[item.parentCommentId]) {
                acc[item.parentCommentId] = [];
              }

              acc[item.parentCommentId].push(item.id);
            }

            return acc;
          }, {} as { [commentId: number]: number[] }),
        ),
      ),
      TE.map(
        ({ entities, map, replies }) =>
          ({
            map,
            replies,
            ids: entities.map((item) => item.id),
          } as CommentTreeData),
      ),
    );
  }

  private getCommentTree(args: {
    commentIds: number[];
    currentDepth: number;
    currentTree: CommentTreeData;
    environment: Environment;
    feedItemId: number;
    requestingUser?: User | null;
    sort: RealmFeedItemCommentSort;
    targetDepth: number;
  }): TE.TaskEither<Error, CommentTreeData> {
    if (args.currentDepth <= args.targetDepth) {
      return FN.pipe(
        this.getCommentReplies({
          commentIds: args.commentIds,
          environment: args.environment,
          feedItemId: args.feedItemId,
          requestingUser: args.requestingUser,
          sort: args.sort,
        }),
        TE.bindTo('replies'),
        TE.bindW('moreReplies', ({ replies }) => {
          if (args.currentDepth === args.targetDepth) {
            return TE.right({ map: {}, replies: {}, ids: [] } as CommentTreeData);
          } else {
            return this.getCommentTree({
              commentIds: replies.ids,
              currentDepth: args.currentDepth + 1,
              currentTree: replies,
              environment: args.environment,
              feedItemId: args.feedItemId,
              requestingUser: args.requestingUser,
              sort: args.sort,
              targetDepth: args.targetDepth,
            });
          }
        }),
        TE.map(({ replies, moreReplies }) => ({
          map: {
            ...replies.map,
            ...moreReplies.map,
          },
          replies: {
            ...replies.replies,
            ...moreReplies.replies,
          },
          ids: replies.ids.concat(moreReplies.ids),
        })),
      );
    }

    return TE.right(args.currentTree);
  }

  private getTopLevelComments(args: {
    after?: RealmFeedItemCommentCursor;
    before?: RealmFeedItemCommentCursor;
    environment: Environment;
    feedItemId: number;
    first?: number;
    last?: number;
    requestingUser?: User | null;
    sort: RealmFeedItemCommentSort;
  }) {
    if (args.first) {
      return this.getFirstNTopLevelComments({
        environment: args.environment,
        feedItemId: args.feedItemId,
        n: args.first,
        requestingUser: args.requestingUser,
        sort: args.sort,
      });
    }

    if (args.last) {
      return this.getLastNTopLevelComments({
        environment: args.environment,
        feedItemId: args.feedItemId,
        n: args.last,
        requestingUser: args.requestingUser,
        sort: args.sort,
      });
    }

    if (args.after) {
      return this.getNTopLevelCommentsAfter({
        after: args.after,
        environment: args.environment,
        feedItemId: args.feedItemId,
        n: PAGE_SIZE,
        requestingUser: args.requestingUser,
        sort: args.sort,
      });
    }

    if (args.before) {
      return this.getNTopLevelCommentsBefore({
        before: args.before,
        environment: args.environment,
        feedItemId: args.feedItemId,
        n: PAGE_SIZE,
        requestingUser: args.requestingUser,
        sort: args.sort,
      });
    }

    return TE.left(new errors.MalformedRequest());
  }

  private getFirstNTopLevelComments(args: {
    environment: Environment;
    feedItemId: number;
    n: number;
    requestingUser?: User | null;
    sort: RealmFeedItemCommentSort;
  }) {
    if (args.environment === 'devnet') {
      return TE.left(new errors.UnsupportedDevnet());
    }

    return TE.tryCatch(
      () =>
        this.realmFeedItemCommentRepository
          .createQueryBuilder('comment')
          .where('comment.environment = :env', { env: args.environment })
          .andWhere('comment.parentCommentId IS NULL')
          .andWhere('comment.feedItemId = :feedItemId', { feedItemId: args.feedItemId })
          .orderBy(this.orderByClause('comment', args.sort))
          .limit(args.n)
          .getMany(),
      (e) => new errors.Exception(e),
    );
  }

  private getLastNTopLevelComments(args: {
    environment: Environment;
    feedItemId: number;
    n: number;
    requestingUser?: User | null;
    sort: RealmFeedItemCommentSort;
  }) {
    if (args.environment === 'devnet') {
      return TE.left(new errors.UnsupportedDevnet());
    }

    return FN.pipe(
      TE.tryCatch(
        () =>
          this.realmFeedItemCommentRepository
            .createQueryBuilder('comment')
            .where('comment.environment = :env', { env: args.environment })
            .andWhere('comment.parentCommentId IS NULL')
            .andWhere('comment.feedItemId = :feedItemId', { feedItemId: args.feedItemId })
            .orderBy(this.orderByClause('comment', args.sort, false))
            .limit(args.n)
            .getMany(),
        (e) => new errors.Exception(e),
      ),
      TE.map((entities) => entities.sort(this.sortEntities(args.sort))),
    );
  }

  private getNTopLevelCommentsAfter(args: {
    after: RealmFeedItemCommentCursor;
    environment: Environment;
    feedItemId: number;
    n: number;
    requestingUser?: User | null;
    sort: RealmFeedItemCommentSort;
  }) {
    if (args.environment === 'devnet') {
      return TE.left(new errors.UnsupportedDevnet());
    }

    const parsedCursor = this.fromCursor(args.after);

    if (parsedCursor.sortOrder !== args.sort) {
      return TE.left(new errors.MalformedRequest());
    }

    const afterClause = this.cursorClause(args.after, 'comment');

    return TE.tryCatch(
      () =>
        this.realmFeedItemCommentRepository
          .createQueryBuilder('comment')
          .where('comment.environment = :env', { env: args.environment })
          .andWhere('comment.parentCommentId IS NULL')
          .andWhere('comment.feedItemId = :feedItemId', { feedItemId: args.feedItemId })
          .andWhere(afterClause.clause, afterClause.params)
          .orderBy(this.orderByClause('comment', args.sort))
          .limit(args.n)
          .getMany(),
      (e) => new errors.Exception(e),
    );
  }

  private getNTopLevelCommentsBefore(args: {
    before: RealmFeedItemCommentCursor;
    environment: Environment;
    feedItemId: number;
    n: number;
    requestingUser?: User | null;
    sort: RealmFeedItemCommentSort;
  }) {
    if (args.environment === 'devnet') {
      return TE.left(new errors.UnsupportedDevnet());
    }

    const parsedCursor = this.fromCursor(args.before);

    if (parsedCursor.sortOrder !== args.sort) {
      return TE.left(new errors.MalformedRequest());
    }

    const beforeClause = this.cursorClause(args.before, 'comment', false);

    return FN.pipe(
      TE.tryCatch(
        () =>
          this.realmFeedItemCommentRepository
            .createQueryBuilder('comment')
            .where('comment.environment = :env', { env: args.environment })
            .andWhere('comment.parentCommentId IS NULL')
            .andWhere('comment.feedItemId = :feedItemId', { feedItemId: args.feedItemId })
            .andWhere(beforeClause.clause, beforeClause.params)
            .orderBy(this.orderByClause('comment', args.sort, false))
            .limit(args.n)
            .getMany(),
        (e) => new errors.Exception(e),
      ),
      TE.map((entities) => entities.sort(this.sortEntities(args.sort))),
    );
  }

  /**
   * Creates a clause that helps find entities before or after another entity
   */
  private cursorClause(cursor: RealmFeedItemCommentCursor, name: string, forwards = true) {
    const parsedCursor = this.fromCursor(cursor);

    const { sortOrder, feedItem } = parsedCursor;

    if (sortOrder === RealmFeedItemCommentSort.New) {
      return {
        clause: `${name}.updated ${forwards ? '<' : '>'} :date`,
        params: { date: feedItem },
      };
    } else if (sortOrder === RealmFeedItemCommentSort.Relevance) {
      return {
        clause: `((${name}.metadata->'relevanceScore')::decimal + ((to_char(${name}.updated, 'YYYYMMDDHH24MI')::decimal) / 10)) ${
          forwards ? '<' : '>'
        } :score`,
        params: { score: feedItem },
      };
    } else {
      return {
        clause: `${name}.metadata->'topAllTimeScore' ${forwards ? '<' : '>'} :score`,
        params: { score: feedItem },
      };
    }
  }

  /**
   * Creates a orderBy clause
   */
  private orderByClause(name: string, sortOrder: RealmFeedItemCommentSort, forwards = true) {
    const desc = forwards ? ('DESC' as const) : ('ASC' as const);

    switch (sortOrder) {
      case RealmFeedItemCommentSort.New:
        return {
          [`${name}.updated`]: desc,
        };
      case RealmFeedItemCommentSort.Relevance:
        return {
          [`((${name}.metadata->'relevanceScore')::decimal + ((to_char(${name}.updated, 'YYYYMMDDHH24MI')::decimal) / 10))`]:
            desc,
        };
      case RealmFeedItemCommentSort.TopAllTime:
        return {
          [`${name}.metadata->'topAllTimeScore'`]: desc,
        };
    }
  }

  /**
   * Get a sort function for a sort order
   */
  private sortEntities(sortOrder: RealmFeedItemCommentSort) {
    return (a: RealmFeedItemCommentEntity, b: RealmFeedItemCommentEntity) => {
      switch (sortOrder) {
        case RealmFeedItemCommentSort.New: {
          return compareDesc(a.updated, b.updated);
        }
        case RealmFeedItemCommentSort.Relevance: {
          if (a.metadata.relevanceScore === b.metadata.relevanceScore) {
            return this.sortEntities(RealmFeedItemCommentSort.New)(a, b);
          }

          return b.metadata.relevanceScore - a.metadata.relevanceScore;
        }
        case RealmFeedItemCommentSort.TopAllTime: {
          if (a.metadata.topAllTimeScore === b.metadata.topAllTimeScore) {
            return this.sortEntities(RealmFeedItemCommentSort.New)(a, b);
          }

          return b.metadata.topAllTimeScore - a.metadata.topAllTimeScore;
        }
      }
    };
  }
}
