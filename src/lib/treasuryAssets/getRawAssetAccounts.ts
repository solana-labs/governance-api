import { TOKEN_PROGRAM_ID } from '@solana/spl-governance';
import type { PublicKey } from "@solana/web3.js";

const TOKEN_ACCOUNT_LAYOUT_SPAN = 165;
const TOKEN_OWNER_OFFSET = 32;

export function getRawAssetAccounts(owners: PublicKey[], commitment?: string) {
  return fetch('https://rpc.theindex.io', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(
      owners.map((pk) => ({
          jsonrpc: '2.0',
          id: 1,
          method: 'getProgramAccounts',
          params: [
            TOKEN_PROGRAM_ID.toBase58(),
            {
              commitment,
              encoding: 'base64',
              filters: [
                {
                  dataSize: TOKEN_ACCOUNT_LAYOUT_SPAN,
                },
                {
                  memcmp: {
                    offset: TOKEN_OWNER_OFFSET,
                    bytes: pk.toBase58(),
                  },
                },
              ],
            },
          ],
        })),
    ),
  }).then<
    {
      result: {
        account: {
          data: any[];
          executable: boolean;
          lamports: number;
          owner: string;
          rentEpoch: number;
        };
        pubkey: string;
      }[];
    }[]
  >((resp) => resp.json())
}
