import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PublicKey } from '@solana/web3.js';
import { compareDesc, differenceInHours, isEqual } from 'date-fns';
import * as AR from 'fp-ts/Array';
import * as FN from 'fp-ts/function';
import * as TE from 'fp-ts/TaskEither';
import * as IT from 'io-ts';
import { In, Repository } from 'typeorm';

import { BrandedString } from '@lib/brands';
import { User } from '@lib/decorators/CurrentUser';
import * as errors from '@lib/errors/gql';
import { Environment } from '@lib/types/Environment';
import { RichTextDocument } from '@src/lib/types/RichTextDocument';

import { RealmFeedItemCommentSort } from './dto/pagination';
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

@Injectable()
export class RealmFeedItemCommentService {
  constructor(
    @InjectRepository(RealmFeedItemCommentEntity)
    private readonly realmFeedItemCommentRepository: Repository<RealmFeedItemCommentEntity>,
    @InjectRepository(RealmFeedItemCommentVoteEntity)
    private readonly realmFeedItemCommentVoteRepository: Repository<RealmFeedItemCommentVoteEntity>,
  ) {}

  /**
   * Add a comment to a feed item
   */
  createComment(args: {
    document: RichTextDocument;
    environment: Environment;
    feedItemId: number;
    parentCommentId?: number | null;
    realmPublicKey: PublicKey;
    requestingUser?: User | null;
  }) {
    if (args.environment === 'devnet') {
      return TE.left(new errors.UnsupportedDevnet());
    }

    if (!args.requestingUser) {
      return TE.left(new errors.Unauthorized());
    }

    const comment = this.realmFeedItemCommentRepository.create({
      authorId: args.requestingUser.id,
      data: { document: args.document },
      environment: args.environment,
      feedItemId: args.feedItemId,
      metadata: { relevanceScore: 0, topAllTimeScore: 0, rawScore: 0 },
      parentCommentId: args.parentCommentId || undefined,
      realmPublicKeyStr: args.realmPublicKey.toBase58(),
    });

    return FN.pipe(
      TE.tryCatch(
        () => this.realmFeedItemCommentRepository.save(comment),
        (e) => new errors.Exception(e),
      ),
      TE.chainW((entity) =>
        this.submitVote({
          environment: args.environment,
          id: entity.id,
          realmPublicKey: args.realmPublicKey,
          requestingUser: args.requestingUser,
          type: RealmFeedItemCommentVoteType.Approve,
        }),
      ),
    );
  }

  /**
   * Get a comment entity from the db
   */
  getCommentEntity(args: {
    environment: Environment;
    id: RealmFeedItemCommentEntity['id'];
    realmPublicKey: PublicKey;
  }) {
    return FN.pipe(
      TE.tryCatch(
        () =>
          this.realmFeedItemCommentRepository.findOne({
            where: {
              id: args.id,
              environment: args.environment,
              realmPublicKeyStr: args.realmPublicKey.toBase58(),
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
    realmPublicKey: PublicKey;
    requestingUser?: User | null;
  }) {}

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
        realmPublicKey: args.realmPublicKey,
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
          const relevanceWeight = Math.ceil(hours / 4);

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
      TE.map(({ comment, userVoteMap }) =>
        this.convertEntityToFeedItem({
          requestingUser,
          entity: comment,
          environment: args.environment,
          realmPublicKey: args.realmPublicKey,
          votes: userVoteMap,
        }),
      ),
    );
  }

  private convertEntityToFeedItem(args: {
    realmPublicKey: PublicKey;
    entity: RealmFeedItemCommentEntity;
    requestingUser: User;
    votes: UserVoteMapping;
    environment: Environment;
  }): RealmFeedItemComment {
    const myVote = args.requestingUser
      ? args.votes[args.entity.id]?.[args.requestingUser.id]
      : undefined;

    return {
      myVote,
      author: { publicKey: args.requestingUser.publicKey },
      created: args.entity.created,
      document: args.entity.data.document,
      feedItemId: args.entity.feedItemId,
      id: args.entity.id,
      parentCommentId: args.entity.parentCommentId,
      score: args.entity.metadata.rawScore,
      updated: args.entity.updated,
    };
  }

  private getFirstNTopLevelComments(args: {
    realmPublicKey: PublicKey;
    requestingUser: User | null;
    n: number;
    environment: Environment;
  }) {}
}
