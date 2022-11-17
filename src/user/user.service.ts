import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PublicKey } from '@solana/web3.js';
import * as FN from 'fp-ts/function';
import * as OP from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import { Repository } from 'typeorm';

import * as errors from '@lib/errors/gql';

import { Data, User } from './entities/User.entity';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * Creates a new user
   */
  createUser(authId: string, publicKey: PublicKey, data: Data) {
    return FN.pipe(
      TE.of(this.userRepository.create({ authId, data, publicKeyStr: publicKey.toBase58() })),
      TE.chain((user) =>
        TE.tryCatch(
          () => this.userRepository.save(user),
          (error) => new errors.Exception(error),
        ),
      ),
    );
  }

  /**
   * Creates a new user or returns one that already exists
   */
  getOrCreateUser(authId: string, publicKey: PublicKey) {
    return FN.pipe(
      this.getUserByAuthId(authId),
      TE.chainW((user) =>
        OP.isSome(user) ? TE.right(user.value) : this.createUser(authId, publicKey, {}),
      ),
    );
  }

  /**
   * Returns a user by their ID
   */
  getUserById(id: string) {
    return FN.pipe(
      TE.tryCatch(
        () => this.userRepository.findOne({ where: { id } }),
        (error) => new errors.Exception(error),
      ),
      TE.map((user) => (user ? OP.some(user) : OP.none)),
    );
  }

  /**
   * Get a user by their AuthId
   */
  getUserByAuthId(authId: string) {
    return FN.pipe(
      TE.tryCatch(
        () => this.userRepository.findOne({ where: { authId } }),
        (error) => new errors.Exception(error),
      ),
      TE.map((user) => (user ? OP.some(user) : OP.none)),
    );
  }
}
