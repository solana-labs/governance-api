import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PublicKey } from '@solana/web3.js';
import { Repository } from 'typeorm';

import { ConfigService } from '@src/config/config.service';

import { MatchdayDiscordUser } from './entities/MatchdayDiscordUser.entity';

// You figure this ID out by passing a Solana NFT into this API: https://simplehash.readme.io/reference/nft-by-token_id-1
// and seeing what collection id gets returned
const SIMPLEHASH_CHALLENGE_PASS_COLLECTION_ID = '220efa958c716cd8ad1788d07861e511';

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

  async getMetadataForUser(publicKey: PublicKey) {
    const { numChallengePasses, oldestChallengePass } = await this.getChallengePassesForUser(
      publicKey,
    );

    return {
      num_challenge_passes: numChallengePasses,
      challenge_pass_held_since: oldestChallengePass,
    };
  }

  async getAccessTokenWithRefreshToken(refreshToken: string) {
    const { client_id, client_secret } = this.getDiscordApplicationCredentials();

    const response = await fetch('https://discord.com/api/v10/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: JSON.stringify({
        client_id,
        client_secret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    const { access_token: accessToken } = await response.json();
    return accessToken;
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
  createDiscordUser(authId: string, publicKey: PublicKey, refreshToken: string) {
    return this.matchdayDiscordUserRepository.upsert(
      {
        authId,
        publicKeyStr: publicKey.toBase58(),
        refreshToken,
      },
      { conflictPaths: ['authId'] },
    );
  }

  /**
   * Returns a user by their ID
   */
  async getDiscordUserByPublicKey(publicKey: PublicKey) {
    return await this.matchdayDiscordUserRepository.findOne({
      where: { publicKeyStr: publicKey.toBase58() },
    });
  }

  async refreshDiscordMetadataForPublicKey(publicKey: PublicKey) {
    const discordUser = await this.getDiscordUserByPublicKey(publicKey);
    if (discordUser) {
      const { refreshToken } = discordUser;

      const { client_id, client_secret } = this.getDiscordApplicationCredentials();

      try {
        const response = await fetch('https://discord.com/api/v10/oauth2/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: JSON.stringify({
            client_id,
            client_secret,
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
          }),
        });

        const { access_token: accessToken } = await response.json();
        await this.updateMetadataForUser(new PublicKey(publicKey), accessToken);
        return { publicKey };
      } catch (e) {
        return null;
      }
    }
  }

  async updateMetadataForUser(publicKey: PublicKey, _accessToken: string) {
    let accessToken = _accessToken;
    if (!accessToken) {
      const discordUser = await this.getDiscordUserByPublicKey(publicKey);
      if (discordUser) {
        accessToken = await this.getAccessTokenWithRefreshToken(discordUser.refreshToken);
      } else {
        throw new Error('No access / refresh token found!');
      }
    }

    const metadata = await this.getMetadataForUser(publicKey);
    this.logger.verbose({ metadata });

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
          metadata,
        }),
      },
    );

    this.logger.verbose({ putResult });
  }
}
