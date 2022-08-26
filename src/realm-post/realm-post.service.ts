import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PublicKey } from '@solana/web3.js';
import * as AR from 'fp-ts/Array';
import * as EI from 'fp-ts/Either';
import * as FN from 'fp-ts/function';
import * as TE from 'fp-ts/TaskEither';
import { PathReporter } from 'io-ts/PathReporter';
import { Repository, In } from 'typeorm';

import * as errors from '@lib/errors/gql';
import { Environment } from '@lib/types/Environment';
import { RichTextDocument } from '@lib/types/RichTextDocument';
import { User } from '@src/lib/decorators/CurrentUser';
import { RichTextDocument as ioRichTextDocument } from '@src/lib/ioTypes/RichTextDocument';

import { RealmPost } from './dto/RealmPost';
import { RealmPost as RealmPostEntity } from './entities/RealmPost.entity';

const TITLE_LENGTH_LIMIT = 300;

@Injectable()
export class RealmPostService {
  constructor(
    @InjectRepository(RealmPostEntity)
    private readonly realmPostRepository: Repository<RealmPostEntity>,
  ) {}

  /**
   * Create a new post
   */
  createPost(
    realmPublicKey: PublicKey,
    title: string,
    document: RichTextDocument,
    requestingUser: User,
    environment: Environment,
  ) {
    if (environment === 'devnet') {
      return TE.left(new errors.UnsupportedDevnet());
    }

    if (title.length > TITLE_LENGTH_LIMIT) {
      return TE.left(new errors.MalformedRequest('Post title is too long'));
    }

    if (document.content.length === 0) {
      return TE.left(new errors.MalformedRequest('Post body cannot be empty'));
    }

    return FN.pipe(
      document,
      ioRichTextDocument.decode,
      TE.fromEither,
      TE.mapLeft(
        (error) =>
          new errors.MalformedRequest(
            'Invalid document: ' + PathReporter.report(EI.left(error)).join('\n'),
          ),
      ),
      TE.map((document) =>
        this.realmPostRepository.create({
          authorId: requestingUser.id,
          data: {
            document,
            title,
          },
          environment,
          realmPublicKeyStr: realmPublicKey.toBase58(),
        }),
      ),
      TE.chainW((entity) =>
        TE.tryCatch(
          () => this.realmPostRepository.save(entity),
          (e) => new errors.Exception(e),
        ),
      ),
      TE.map((entity) => ({
        author: {
          publicKey: requestingUser.publicKey,
        },
        created: entity.created,
        document: entity.data.document,
        id: entity.id,
        title: entity.data.title,
        updated: entity.updated,
      })),
    );
  }

  /**
   * Get posts by ids
   */
  getPostsForRealmByIds(
    realmPublicKey: PublicKey,
    ids: string[],
    requestingUser: PublicKey | null,
    environment: Environment,
  ) {
    if (environment === 'devnet') {
      return TE.left(new errors.UnsupportedDevnet());
    }

    return FN.pipe(
      TE.tryCatch(
        () =>
          this.realmPostRepository.find({
            where: {
              environment,
              id: In(ids),
              realmPublicKeyStr: realmPublicKey.toBase58(),
            },
            relations: ['author'],
          }),
        (e) => new errors.Exception(e),
      ),
      TE.map(
        AR.map((entity) => ({
          author: {
            publicKey: new PublicKey(entity.author.publicKeyStr),
          },
          created: entity.created,
          document: entity.data.document,
          id: entity.id,
          title: entity.data.title,
          updated: entity.updated,
        })),
      ),
      TE.map(
        AR.reduce({} as { [id: string]: RealmPost }, (acc, post) => {
          acc[post.id] = post;
          return acc;
        }),
      ),
    );
  }
}
