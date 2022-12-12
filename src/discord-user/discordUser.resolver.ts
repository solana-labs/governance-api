import { Resolver, Mutation, Args } from '@nestjs/graphql';

import { CurrentUser, User } from '@lib/decorators/CurrentUser';
import * as errors from '@lib/errors/gql';
import { ConfigService } from '@src/config/config.service';

import { DiscordUserService } from './discordUser.service';

import { DiscordApplication, VerifyWallet } from './dto/VerifyWallet';
import { MatchdayDiscordUserService } from './matchdayDiscordUser.service';

@Resolver()
export class DiscordUserResolver {
  constructor(
    private readonly discordUserService: DiscordUserService,
    private readonly matchdayDiscordUserService: MatchdayDiscordUserService,
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
      type: () => DiscordApplication,
    })
    application: DiscordApplication,
    @CurrentUser()
    user: User | null,
  ) {
    if (!user) {
      throw new errors.Unauthorized();
    }

    const userService =
      application === DiscordApplication.MATCHDAY
        ? this.matchdayDiscordUserService
        : this.discordUserService;

    const redirectURI =
      application === DiscordApplication.MATCHDAY
        ? this.configService.get('matchdayDiscord.oauthRedirectUri')
        : this.configService.get('discord.oauthRedirectUri');

    const { client_id, client_secret } = userService.getDiscordApplicationCredentials();

    const tokenResponseData = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      body: new URLSearchParams({
        client_id,
        client_secret,
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

    await userService.createDiscordUser(user.id, user.publicKey, refreshToken);
    await userService.updateMetadataForUser(user.publicKey, accessToken);

    return user;
  }
}
