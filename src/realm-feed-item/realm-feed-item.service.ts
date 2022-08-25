import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PublicKey } from '@solana/web3.js';
import { compareDesc, isEqual } from 'date-fns';
import * as AR from 'fp-ts/Array';
import * as FN from 'fp-ts/function';
import * as TE from 'fp-ts/TaskEither';
import { Repository } from 'typeorm';

import * as errors from '@lib/errors/gql';
import { exists } from '@lib/typeGuards/exists';
import { Environment } from '@lib/types/Environment';
import { RealmPostService } from '@src/realm-post/realm-post.service';
import { RealmProposalState } from '@src/realm-proposal/dto/RealmProposalState';
import { RealmProposalService } from '@src/realm-proposal/realm-proposal.service';

import { RealmFeedItem, RealmFeedItemPost, RealmFeedItemProposal } from './dto/RealmFeedItem';
import { RealmFeedItemType } from './dto/RealmFeedItemType';
import { RealmFeedItem as RealmFeedItemEntity } from './entities/RealmFeedItem.entity';

@Injectable()
export class RealmFeedItemService {
  constructor(
    @InjectRepository(RealmFeedItemEntity)
    private readonly realmFeedItemRepository: Repository<RealmFeedItemEntity>,
    private readonly realmPostService: RealmPostService,
    private readonly realmProposalService: RealmProposalService,
  ) {}

  /**
   * Convert raw entities into feed items
   */
  convertEntitiesToFeedItems(
    realmPublicKey: PublicKey,
    entities: RealmFeedItemEntity[],
    requestingUser: PublicKey | null,
    environment: Environment,
  ) {
    if (environment === 'devnet') {
      return TE.left(new errors.UnsupportedDevnet());
    }

    return FN.pipe(
      TE.of(this.splitEntitiesIntoTypes(entities)),
      TE.bindTo('entities'),
      TE.bindW('posts', ({ entities }) =>
        this.convertPostEntitiesToFeedItems(
          realmPublicKey,
          entities.posts,
          requestingUser,
          environment,
        ),
      ),
      TE.bindW('proposals', ({ entities }) =>
        this.convertProposalEntitiesToFeedItems(
          realmPublicKey,
          entities.proposals,
          requestingUser,
          environment,
        ),
      ),
      TE.map(({ posts, proposals }) => this.organizeFeedItemsListIntoMap([...posts, ...proposals])),
    );
  }

  /**
   * Return a single feed item
   */
  getFeedItem(
    realmPublicKey: PublicKey,
    id: RealmFeedItemEntity['id'],
    requestingUser: PublicKey | null,
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
      TE.chainW((entity) =>
        this.convertEntityToFeedItem(realmPublicKey, entity, requestingUser, environment),
      ),
    );
  }

  /**
   * Returns a list of pinned feed items
   */
  getPinnedFeedItems(
    realmPublicKey: PublicKey,
    requestingUser: PublicKey | null,
    environment: Environment,
  ) {
    if (environment === 'devnet') {
      return TE.left(new errors.UnsupportedDevnet());
    }

    return FN.pipe(
      this.realmProposalService.getProposalsForRealm(realmPublicKey, environment),
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
      TE.chainW((entities) =>
        this.convertProposalEntitiesToFeedItems(
          realmPublicKey,
          entities,
          requestingUser,
          environment,
        ),
      ),
    );
  }

  /**
   * Ensure that all the proposals are accurately represented as feed items
   */
  syncProposalsToFeedItems(realmPublicKey: PublicKey, environment: Environment) {
    if (environment === 'devnet') {
      return TE.left(new errors.UnsupportedDevnet());
    }

    return FN.pipe(
      this.realmProposalService.getProposalsForRealm(realmPublicKey, environment),
      TE.bindTo('proposals'),
      TE.bindW('existingEntities', ({ proposals }) =>
        TE.tryCatch(
          () =>
            this.realmFeedItemRepository
              .createQueryBuilder('feeditem')
              .where('feeditem.environment = :env', { env: environment })
              .andWhere(`"feeditem"."data"->'ref' IN (:...ids)`, {
                ids: proposals.map((p) => JSON.stringify(p.publicKey.toBase58())),
              })
              .andWhere('feeditem.realmPublicKeyStr = :pk', { pk: realmPublicKey.toBase58() })
              .andWhere(`"feeditem"."data"->'type' = :type`, {
                type: JSON.stringify(RealmFeedItemType.Proposal),
              })
              .getMany(),
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
    );
  }

  /**
   * Convert a single entity into a feed item
   */
  private convertEntityToFeedItem(
    realmPublicKey: PublicKey,
    entity: RealmFeedItemEntity,
    requestingUser: PublicKey | null,
    environment: Environment,
  ) {
    switch (entity.data.type) {
      case RealmFeedItemType.Post:
        return FN.pipe(
          this.realmPostService.getPostsForRealmByIds(
            realmPublicKey,
            [entity.data.ref],
            requestingUser,
            environment,
          ),
          TE.map((mapping) => mapping[entity.data.ref]),
          TE.chainW(TE.fromNullable(new errors.NotFound())),
          TE.map(
            () =>
              ({
                type: RealmFeedItemType.Post,
                created: entity.created,
                id: entity.id.toString(),
                score: entity.metadata.rawScore,
                updated: entity.updated,
              } as typeof RealmFeedItem),
          ),
        );
      case RealmFeedItemType.Proposal:
        return FN.pipe(
          this.realmProposalService.getProposalsForRealmAndUserByPublicKeys(
            realmPublicKey,
            [new PublicKey(entity.data.ref)],
            requestingUser,
            environment,
          ),
          TE.map((mapping) => mapping[entity.data.ref]),
          TE.chainW(TE.fromNullable(new errors.NotFound())),
          TE.map(
            (proposal) =>
              ({
                proposal,
                type: RealmFeedItemType.Proposal,
                created: entity.created,
                id: entity.id.toString(),
                score: entity.metadata.rawScore,
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
    requestingUser: PublicKey | null,
    environment: Environment,
  ) {
    return FN.pipe(
      this.realmPostService.getPostsForRealmByIds(
        realmPublicKey,
        entities.map((p) => p.data.ref),
        requestingUser,
        environment,
      ),
      TE.map(() =>
        entities.map(
          (post) =>
            ({
              type: RealmFeedItemType.Post,
              created: post.created,
              id: post.id.toString(),
              score: post.metadata.rawScore,
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
    requestingUser: PublicKey | null,
    environment: Environment,
  ) {
    return FN.pipe(
      this.realmProposalService.getProposalsForRealmAndUserByPublicKeys(
        realmPublicKey,
        entities.map((p) => new PublicKey(p.data.ref)),
        requestingUser,
        environment,
      ),
      TE.map((proposalMap) =>
        entities
          .map(
            (proposal) =>
              ({
                type: RealmFeedItemType.Proposal,
                created: proposal.created,
                id: proposal.id.toString(),
                proposal: proposalMap[proposal.data.ref],
                score: proposal.metadata.rawScore,
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
