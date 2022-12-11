import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PublicKey } from '@solana/web3.js';
import { Repository } from 'typeorm';

import { ConfigService } from '@src/config/config.service';

import { MatchdayDiscordUser } from './entities/MatchdayDiscordUser.entity';

// You figure this ID out by passing a Solana NFT into this API: https://simplehash.readme.io/reference/nft-by-token_id-1
// and seeing what collection id gets returned
const SIMPLEHASH_CHALLENGE_PASS_COLLECTION_ID = '220efa958c716cd8ad1788d07861e511';

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

@Injectable()
export class MatchdayDiscordUserService {
  private logger = new Logger(MatchdayDiscordUserService.name);

  constructor(
    @InjectRepository(MatchdayDiscordUser)
    private readonly matchdayDiscordUserRepository: Repository<MatchdayDiscordUser>,
    private readonly configService: ConfigService,
  ) {}

  async getChallengePassesForUser(publicKey: PublicKey) {
    const SIMPLEHASH_URL = `https://api.simplehash.com/api/v0/nfts/owners?${new URLSearchParams({
      chains: 'solana',
      wallet_addresses: publicKey.toBase58(),
      collection_id: SIMPLEHASH_CHALLENGE_PASS_COLLECTION_ID,
    }).toString()}`;

    const challengePassesResponse = await fetch(SIMPLEHASH_URL, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'x-api-key': this.configService.get('simplehash.apiKey'),
      },
    });

    const { nfts } = await challengePassesResponse.json();

    if (nfts.length) {
      const oldestChallengePass = nfts
        .map((nft) => new Date(nft.owners[0].first_acquired_date))
        .sort((a, b) => a.getTime() - b.getTime())[0];

      return {
        numChallengePasses: nfts.length,
        oldestChallengePass,
      };
    }

    return { numChallengePasses: 0 };
  }

  async getMatchdayMetadata(
    accessToken: string,
  ): Promise<{ matchdayUsername: string; twitterFollow: boolean }> {
    const discordResponse = await (
      await fetch('https://discord.com/api/users/@me', {
        headers: {
          'authorization': `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
      })
    ).json();

    const MATCHDAY_API_URL = `https://discordapi.matchday.com/verify/${discordResponse.id}`;
    const matchdayResponse = await (
      await fetch(MATCHDAY_API_URL, {
        method: 'GET',
        headers: {
          auth: process.env.MATCHDAY_API_KEY!,
        },
      })
    ).json();

    return matchdayResponse.data;
  }

  async getMetadataForUser(publicKey: PublicKey, accessToken: string) {
    const { numChallengePasses, oldestChallengePass } = await this.getChallengePassesForUser(
      publicKey,
    );

    const { matchdayUsername, twitterFollow } = await this.getMatchdayMetadata(accessToken);

    return {
      platform_username: matchdayUsername,
      metadata: {
        num_challenge_passes: numChallengePasses,
        challenge_pass_held_since: oldestChallengePass,
        following_on_twitter: twitterFollow ? 1 : 0,
      },
    };
  }

  async getAccessTokenWithRefreshToken(refreshToken: string) {
    const { client_id, client_secret } = this.getDiscordApplicationCredentials();
    const body = new URLSearchParams({
      client_id,
      client_secret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }).toString();

    const response = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });

    const { access_token: accessToken, refresh_token } = await response.json();
    return { accessToken, refreshToken: refresh_token };
  }

  getDiscordApplicationCredentials() {
    return {
      client_id: this.configService.get('matchdayDiscord.clientId'),
      client_secret: this.configService.get('matchdayDiscord.clientSecret'),
    };
  }

  /**
   * Creates a new Discord user
   */
  async createDiscordUser(authId: string, publicKey: PublicKey, refreshToken: string) {
    const insertResult = await this.matchdayDiscordUserRepository.upsert(
      {
        authId,
        publicKeyStr: publicKey.toBase58(),
        refreshToken,
      },
      { conflictPaths: ['authId'] },
    );

    return insertResult;
  }

  /**
   * Returns a user by their ID
   */
  async getDiscordUserByPublicKey(publicKey: PublicKey) {
    const result = await this.matchdayDiscordUserRepository.findOne({
      where: { publicKeyStr: publicKey.toBase58() },
    });
    return result;
  }

  async updateMetadataForUser(
    publicKey: PublicKey,
    _accessToken?: string | null,
    delayDuration = 0,
  ) {
    let accessToken = _accessToken;
    if (!accessToken) {
      const discordUser = await this.getDiscordUserByPublicKey(publicKey);
      if (discordUser) {
        const newAccessAndRefreshToken = await this.getAccessTokenWithRefreshToken(
          discordUser.refreshToken,
        );

        accessToken = newAccessAndRefreshToken.accessToken;

        this.logger.debug(`Storing refresh token for ${publicKey.toBase58()}`);
        await this.matchdayDiscordUserRepository.update(discordUser.id, {
          refreshToken: newAccessAndRefreshToken.refreshToken,
        });
      } else {
        this.logger.error(`Discord user for ${publicKey.toBase58()} not found`);
        throw new Error('Discord user not found');
      }
    }

    this.logger.debug(`Updating metadata for ${publicKey.toBase58()}`);

    // if (delayDuration) {
    //   // The Helius webhook comes in at `confirmed`, and SimpleHash updates at `finalized`.
    //   // Solana is too fast, imo
    //   // TODO(jon): Re-evaluate this
    //   await delay(delayDuration);
    // }

    const { metadata, platform_username } = await this.getMetadataForUser(publicKey, accessToken!);
    this.logger.verbose({ platform_username, metadata });

    const { client_id: clientId } = this.getDiscordApplicationCredentials();
    const putResult = await fetch(
      `https://discord.com/api/users/@me/applications/${clientId}/role-connection`,
      {
        method: 'PUT',
        headers: {
          'authorization': `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          platform_name: 'Matchday',
          platform_username,
          metadata,
        }),
      },
    );

    this.logger.verbose({ putResult });
  }
}
