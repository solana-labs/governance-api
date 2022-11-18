import { Resolver, Mutation, Args, Context } from '@nestjs/graphql';
import { CurrentUser } from '@src/lib/decorators/CurrentUser';

import { DiscordUserService } from './discordUser.service';

import { VerifyWallet } from './dto/VerifyWallet';

const MAX_TXS_TO_SCAN: number = 10000;

const clientId = '1042836142560645130';
const clientSecret = 'xFRUiukWAXwJmn0nkK2xK5EfEFKtgzuH';
const port = 3000;
const redirectUri = `http://localhost:${port}/verify-wallet`;

const apiURL = 'https://api.helius.xyz/v0/addresses';
const options = '?api-key=8ff76c55-268e-4c41-9916-cb55b8132089';

type WalletAge = {
  txId: string;
  slot: number;
  timestamp: number;
  date: string;
  numTransactions: number;
};

async function getLargeAmountOfTransactions(
  address: string,
  maxCount: number,
): Promise<WalletAge | undefined> {
  const resource = 'transactions';
  let page = 1;
  let oldestTransaction: WalletAge | undefined;
  let numTxs = 0;

  while (numTxs < maxCount) {
    const url = `${apiURL}/${address}/${resource}${options}&before=${
      oldestTransaction?.txId ?? ''
    }`;
    const body = await fetch(url);
    const text = await body.text();
    const data = JSON.parse(text);
    // const { data } = await (await fetch(url)).json();
    if (data.length === 0) {
      // Exhausted all transactions for the given address
      return oldestTransaction;
    }
    console.log(`Got ${data.length} transactions from page ${page}!`);
    numTxs += data.length;

    // API data is already sorted in descending order
    const oldestTxInfo = data[data.length - 1];
    const date = new Date(0);
    date.setUTCSeconds(oldestTxInfo.timestamp);
    oldestTransaction = {
      txId: oldestTxInfo.signature,
      slot: oldestTxInfo.slot,
      timestamp: oldestTxInfo.timestamp,
      date: date.toISOString().split('T')[0],
      numTransactions: numTxs,
    };
    page += 1;
  }

  return oldestTransaction;
}

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

    const txScanResult = await getLargeAmountOfTransactions(
      user.publicKey.toBase58(),
      MAX_TXS_TO_SCAN,
    );

    if (!txScanResult) {
      return { status: 'we failed while scanning txs for pubkey' };
    }

    const walletAge: WalletAge = txScanResult;
    console.log('Found wallet age:', walletAge);

    const putResult = await fetch(
      `https://discord.com/api/users/@me/applications/${clientId}/role-connection`,
      {
        headers: {
          'authorization': `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          platform_name: 'Solana',
          metadata: {
            first_wallet_transaction_date: walletAge.date,
          },
        }),
        method: 'PUT',
      },
    );
    console.log('setting metadata', putResult.status);

    // response.sendStatus(200);
    return { status: 'we also good here' };
  }
}
