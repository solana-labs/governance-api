import { Resolver, Mutation, Args } from '@nestjs/graphql';
import { ConfigService } from '@src/config/config.service';

import { CurrentUser, User } from '@src/lib/decorators/CurrentUser';

import { DiscordUserService } from './discordUser.service';

import { VerifyWallet } from './dto/VerifyWallet';

import * as errors from '@lib/errors/gql';

@Resolver()
export class DiscordUserResolver {
  constructor(
    private readonly discordUserService: DiscordUserService,
    private readonly configService: ConfigService,
  ) {}

  @Mutation(() => VerifyWallet, {
    description:
      'Generate an authentication claim that a wallet can sign and trade for an auth token',
  })
  async verifyWallet(
    @Args('code', {
      description: 'Authorization code for Discord',
    })
    code: string,
    @CurrentUser()
    user: User | null,
  ) {
    if (!user) { throw new errors.Unauthorized() }

    const tokenResponseData = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      body: new URLSearchParams({
        client_id: this.configService.get('discord.clientId'),
        client_secret: this.configService.get('discord.clientSecret'),
        code,
        grant_type: 'authorization_code',
        redirect_uri: this.configService.get('discord.oauthRedirectUri'),
        scope: 'identify',
      }).toString(),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    const oauthData = await tokenResponseData.json();
    console.log('oauth data:', oauthData);

    const { refresh_token: refreshToken, access_token: accessToken } = oauthData;

    await this.discordUserService.createDiscordUser(user.id, user.publicKey, refreshToken);
    await this.discordUserService.updateMetadataForUser(user.publicKey, accessToken);

    return user;
  }
}
