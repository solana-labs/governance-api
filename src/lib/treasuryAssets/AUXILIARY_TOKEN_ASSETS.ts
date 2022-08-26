import { PublicKey } from "@solana/web3.js"

interface Asset {
  owner: PublicKey;
  accounts: PublicKey[];
}

interface AssetDefinition {
  [key: string]: Asset[];
}

/**
 * A list of auxiliary assets registered to a Realm
 */
export const AUXILIARY_TOKEN_ASSETS: AssetDefinition = {
  // Mango
  'DPiH3H3c7t47BMxqTxLsuPQpEC6Kne8GA9VXbxpnZxFE': [
    {
      owner: new PublicKey('9BVcYqEQxyccuwznvxXqDkSJFavvTyheiTYk231T1A8S'),
      accounts: [
        new PublicKey('59BEyxwrFpt3x4sZ7TcXC3bHx3seGfqGkATcDx6siLWy'),
      ],
    },
    {
      owner: new PublicKey('GHsErpcUbwiw1eci65HCDQzySKwQCxYRi5MrGeGpq5dn'),
      accounts: [
        new PublicKey('8tKwcKM4obpoPmTZNZKDt5cCkAatrwHBNteXNrZRvjWj')
      ]
    }
  ],
};
