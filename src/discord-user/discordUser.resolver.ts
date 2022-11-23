import { Resolver, Mutation, Args } from '@nestjs/graphql';

import { CurrentUser, User } from '@lib/decorators/CurrentUser';
import * as errors from '@lib/errors/gql';
import { ConfigService } from '@src/config/config.service';

import { DiscordUserService } from './discordUser.service';

import { DiscordApplication, VerifyWallet } from './dto/VerifyWallet';

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
    @Args('application', {
      description: 'Which Discord application is this for?',
    })
    application: DiscordApplication,
    @CurrentUser()
    user: User | null,
  ) {
    if (!user) {
      throw new errors.Unauthorized();
    }

    const redirectURI =
      application === DiscordApplication.MATCHDAY
        ? this.configService.get('matchdayDiscord.oauthRedirectUri')
        : this.configService.get('discord.oauthRedirectUri');

    const tokenResponseData = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      body: new URLSearchParams({
        client_id: this.configService.get('discord.clientId'),
        client_secret: this.configService.get('discord.clientSecret'),
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectURI,
        scope: 'identify',
      }).toString(),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    const oauthData = await tokenResponseData.json();

    const { refresh_token: refreshToken, access_token: accessToken } = oauthData;

    await this.discordUserService.createDiscordUser(
      user.id,
      user.publicKey,
      refreshToken,
      application,
    );
    await this.discordUserService.updateMetadataForUser(user.publicKey, accessToken, application);

    return user;
  }
}
