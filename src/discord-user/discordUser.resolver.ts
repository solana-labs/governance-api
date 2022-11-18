import { Resolver, Mutation, Args, Context, Query } from '@nestjs/graphql';
import { Connection, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';

import { CurrentUser, User } from '@src/lib/decorators/CurrentUser';

import { DiscordUserService } from './discordUser.service';

import { RefreshToken } from './dto/DiscordUser';
import { VerifyWallet } from './dto/VerifyWallet';

const MINIMUM_SOL = 0.1;
const MAX_TXS_TO_SCAN = 10000;
const clientId = '1042836142560645130';
const clientSecret = 'xFRUiukWAXwJmn0nkK2xK5EfEFKtgzuH';
const port = 3000;
// const redirectUri = `http://localhost:${port}/verify-wallet`;
const redirectUri = "https://solana-verify-wallet-testing-ngundotra.vercel.app/verify-wallet";

const HELIUS_BASE_URL = 'https://api.helius.xyz/v0';
const HELIUS_ADDRESSES_URL = `${HELIUS_BASE_URL}/addresses`;
const options = '?api-key=8ff76c55-268e-4c41-9916-cb55b8132089';
const HELIUS_BALANCES_URL = (address) =>
  `${HELIUS_BASE_URL}/addresses/${address}/balances${options}`;

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
    const url = `${HELIUS_ADDRESSES_URL}/${address}/${resource}${options}&before=${
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

const activeWithin30Days = async (publicKey: string) => {
  const req = await fetch(`${HELIUS_ADDRESSES_URL}/${publicKey}/transactions${options}`);
  const recentTxes = await req.json();

  if (recentTxes.length) {
    const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;
    const timestampThirtyDaysAgo = new Date().getTime() - thirtyDaysInMs;
    const mostRecentTxTimestamp = recentTxes[0].timestamp * 1000;

    console.info({ mostRecentTxTimestamp, timestampThirtyDaysAgo });
    return mostRecentTxTimestamp >= timestampThirtyDaysAgo;
  }
  return null;
};

const getSolBalance = async (publicKey: string) => {
  console.info({ url: HELIUS_BALANCES_URL(publicKey) });
  const response = await fetch(HELIUS_BALANCES_URL(publicKey));
  const responseJson = await response.json();
  console.info({ responseJson });
  const { nativeBalance }: { nativeBalance: number } = responseJson;

  console.info({ nativeBalance });

  return nativeBalance / LAMPORTS_PER_SOL >= MINIMUM_SOL;
};

const getMetadataForUser = async (publicKey: PublicKey) => {
  const walletAge = await getLargeAmountOfTransactions(publicKey.toBase58(), MAX_TXS_TO_SCAN);
  const hasMinimumSol = await getSolBalance(publicKey.toBase58());
  const isRecentlyActive = await activeWithin30Days(publicKey.toBase58());

  return {
    first_wallet_transaction: walletAge?.date ?? null,
    most_recent_wallet_transaction: isRecentlyActive ? 1 : 0,
    has_minimum_sol: hasMinimumSol ? 1 : 0,
  };
};

const updateMetadataForUser = async (publicKey: PublicKey, accessToken: string) => {
  const metadata = await getMetadataForUser(publicKey);
  console.info({ metadata });

  const putResult = await fetch(
    `https://discord.com/api/users/@me/applications/${clientId}/role-connection`,
    {
      method: 'PUT',
      headers: {
        'authorization': `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        platform_name: 'Solana',
        metadata,
      }),
    },
  );

  console.info({ putResult });
};

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
    await updateMetadataForUser(user.publicKey, accessToken);

    return user;
  }

  @Mutation(() => VerifyWallet, {
    description:
      'Generate an authentication claim that a wallet can sign and trade for an auth token',
  })
  async refreshDiscordUserMetadata(
    @Args('publicKey', {
      description: 'Public key of user',
    })
    publicKey: string,
  ) {
    const discordUser = await this.discordUserService.getDiscordUserByPublicKey(
      new PublicKey(publicKey),
    );
    if (discordUser) {
      const { refreshToken } = discordUser;

      try {
        const response = await fetch('https://discord.com/api/v10/oauth2/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: JSON.stringify({
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
          }),
        });

        const { access_token: accessToken } = await response.json();
        await updateMetadataForUser(new PublicKey(publicKey), accessToken);
        return { publicKey };
      } catch (e) {
        return null;
      }
    }
  }
}
