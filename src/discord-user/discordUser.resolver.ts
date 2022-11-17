import { Resolver, Mutation, Args, Context } from '@nestjs/graphql';
import { PublicKey } from '@solana/web3.js';
import { CurrentUser } from '@src/lib/decorators/CurrentUser';

import { DiscordUserService } from './discordUser.service';

import { VerifyWallet } from './dto/VerifyWallet';

type WalletAge = {
  txId: string;
  slot: number;
  timestamp: number;
  date: string;
  numTransactions: number;
};

const clientId = '1040316721359237240';
const clientSecret = 'LQdJExIxICISE_GoBX1cid6mSlBjmKCD';
const port = 55124;
const redirectUri = `http://localhost:${port}`;

const apiURL = 'https://api.helius.xyz/v0/addresses';
const options = '?api-key=8ff76c55-268e-4c41-9916-cb55b8132089';

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
    console.info({ user });
    // const tokenResponseData = await fetch('https://discord.com/api/oauth2/token', {
    //   method: 'POST',
    //   body: new URLSearchParams({
    //     client_id: clientId,
    //     client_secret: clientSecret,
    //     code,
    //     grant_type: 'authorization_code',
    //     redirect_uri: redirectUri,
    //     scope: 'identify',
    //   }).toString(),
    //   headers: {
    //     'Content-Type': 'application/x-www-form-urlencoded',
    //   },
    // });
    // const oauthData = await tokenResponseData.json();
    // console.log('oauth data:', oauthData);

    // const { refresh_token: refreshToken, access_token: accessToken } = oauthData;

    // const publicKey = new PublicKey(address);
    // const walletAge: WalletAge = await getLargeAmountOfTransactions(address as string, 10000);
    // console.log('Found wallet age:', walletAge);

    // const putResult = await request(
    //   `https://discord.com/api/users/@me/applications/${clientId}/role-connection`,
    //   {
    //     headers: {
    //       'authorization': `${tokenType} ${accessToken}`,
    //       'content-type': 'application/json',
    //     },
    //     body: JSON.stringify({
    //       platform_name: 'Solana',
    //       metadata: {
    //         fwt: walletAge.date,
    //       },
    //     }),
    //     method: 'PUT',
    //   },
    // );
    // console.log('setting metadata', putResult.statusCode);

    // response.sendStatus(200);
    return { status: 'we also goo dhere' };
  }
}
