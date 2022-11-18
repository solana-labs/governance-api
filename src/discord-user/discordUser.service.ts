import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PublicKey } from '@solana/web3.js';
import * as FN from 'fp-ts/function';
import * as OP from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import { Repository } from 'typeorm';

import * as errors from '@lib/errors/gql';

import { DiscordUser } from './entities/DiscordUser.entity';

@Injectable()
export class DiscordUserService {
  constructor(
    @InjectRepository(DiscordUser)
    private readonly discordUserRepository: Repository<DiscordUser>,
  ) {}

  /**
   * Creates a new Discord user
   */
  createDiscordUser(authId: string, publicKey: PublicKey, refreshToken: string) {
    try {
      return this.discordUserRepository.upsert(
        {
          authId,
          publicKeyStr: publicKey.toBase58(),
          refreshToken,
        },
        { conflictPaths: ['authId'] },
      );

      // return this.discordUserRepository.save(discordUser);
    } catch (e) {
      throw new errors.Exception(e);
    }
  }

  /**
   * Returns a user by their ID
   */
  async getDiscordUserByPublicKey(publicKey: PublicKey) {
    try {
      return await this.discordUserRepository.findOne({
        where: { publicKeyStr: publicKey.toBase58() },
      });
    } catch (e) {
      throw new errors.Exception(e);
    }
  }
}
