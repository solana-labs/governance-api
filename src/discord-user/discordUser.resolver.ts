import { Resolver, Mutation, Args } from '@nestjs/graphql';

import { CurrentUser } from '@src/lib/decorators/CurrentUser';

import { DiscordUserService } from './discordUser.service';

import { VerifyWallet } from './dto/VerifyWallet';
import { PublicKey } from '@solana/web3.js';

const clientId = process.env.DISCORD_CONNECTION_CLIENT_ID as string;
const clientSecret = process.env.DISCORD_CONNECTION_CLIENT_SECRET as string;
const redirectUri = process.env.DISCORD_OAUTH_REDIRECT_URI as string;

@Resolver()
export class DiscordUserResolver {
  constructor(private readonly discordUserService: DiscordUserService) {}

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
    user,
  ) {
    const tokenResponseData = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
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
