import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PublicKey } from '@solana/web3.js';
import { isEqual } from 'date-fns';
import * as AR from 'fp-ts/Array';
import * as FN from 'fp-ts/function';
import * as TE from 'fp-ts/TaskEither';
import { Repository } from 'typeorm';

import * as errors from '@lib/errors/gql';
import { Environment } from '@lib/types/Environment';
import { RealmPostService } from '@src/realm-post/realm-post.service';
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
    return FN.pipe(
      entities,
      AR.reduce(
        { posts: [], proposals: [] } as {
          posts: RealmFeedItemEntity[];
          proposals: RealmFeedItemEntity[];
        },
        (acc, entity) => {
          if (entity.data.type === RealmFeedItemType.Post) {
            acc.posts.push(entity);
          }

          if (entity.data.type === RealmFeedItemType.Proposal) {
            acc.proposals.push(entity);
          }

          return acc;
        },
      ),
      ({ posts, proposals }) =>
        FN.pipe(
          this.realmPostService.getPostsForRealmByIds(
            realmPublicKey,
            posts.map((p) => p.data.ref),
            requestingUser,
            environment,
          ),
          TE.map(() =>
            posts.map(
              (post) =>
                ({
                  type: RealmFeedItemType.Post,
                  id: post.id,
                  score: post.metadata.rawScore,
                } as RealmFeedItemPost),
            ),
          ),
          TE.bindTo('posts'),
          TE.bind('proposals', () =>
            FN.pipe(
              this.realmProposalService.getProposalsForRealmAndUserByPublicKeys(
                realmPublicKey,
                proposals.map((p) => new PublicKey(p.data.ref)),
                requestingUser,
                environment,
              ),
              TE.map((proposalMap) =>
                proposals
                  .map(
                    (proposal) =>
                      ({
                        type: RealmFeedItemType.Proposal,
                        id: proposal.id,
                        proposal: proposalMap[proposal.data.ref],
                        score: proposal.metadata.rawScore,
                      } as RealmFeedItemProposal),
                  )
                  .filter((proposal) => !!proposal.proposal),
              ),
            ),
          ),
        ),
      TE.map(({ posts, proposals }) => {
        const map: { [id: string]: typeof RealmFeedItem } = {};

        for (const post of posts) {
          map[post.id] = post;
        }

        for (const proposal of proposals) {
          map[proposal.id] = proposal;
        }

        return map;
      }),
      TE.map((mapping) => entities.map((entity) => mapping[entity.id])),
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
              .createQueryBuilder('FeedItem')
              .select()
              .where('FeedItem.environment = :env', { env: environment })
              .andWhere('FeedItem.data->ref IN :ids', {
                ids: proposals.map((p) => p.publicKey.toBase58()),
              })
              .andWhere('FeedItem.realmPublicKeyStr = :pk', { pk: realmPublicKey.toBase58() })
              .andWhere(`FeedItem.data::jsonb @> \'{"type":"${RealmFeedItemType.Proposal}"}\'`)
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

        if (!updateExisting && !!newProposals.length) {
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
                    topScore: 0,
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
}
