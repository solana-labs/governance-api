<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="200" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://coveralls.io/github/nestjs/nest?branch=master" target="_blank"><img src="https://coveralls.io/repos/github/nestjs/nest/badge.svg?branch=master#9" alt="Coverage" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Installation

```bash
$ yarn install
```

## Setup

Copy the `.env.example` file to `.env` and fill in the values.

Most of the values are self-explanatory. Check [these instructions](#setup-dialect-app) on how to register a Dialect app.

```bash
$ cp .env.example .env
```

Start the Postgres database:

```bash
$ docker compose up
```

Run the database migrations:

```bash
$ yarn run db:setup
```

## Running the app

```bash
# development
$ yarn run start

# watch mode
$ yarn run start:dev

# production mode
$ yarn run start:prod
```

## Test

```bash
# unit tests
$ yarn run test

# e2e tests
$ yarn run test:e2e

# test coverage
$ yarn run test:cov
```

## Setup Dialect App

The steps below explain how to set up the Dialect app to work with the API.

- Generate a new keypair

```
solana-keygen new --no-bip39-passphrase --outfile ./tmp/dialect.json
```

- Set an ENV var with the content of the generated file

```
export DIALECT_APP_KEYPAIR=$(cat ./tmp/dialect.json)
```

- Create a script to register the app

```ts
// ./tmp/register-dialect-app.ts
import {
  NodeDialectSolanaWalletAdapter,
  Solana,
  SolanaSdkFactory,
} from '@dialectlabs/blockchain-sdk-solana';
import { BlockchainType, Dialect, DialectSdk, TokenStore } from '@dialectlabs/sdk';

const sdk: DialectSdk<Solana> = Dialect.sdk(
  {
    dialectCloud: { tokenStore: TokenStore.createInMemory() },
    environment: 'development',
  },
  SolanaSdkFactory.create({
    wallet: NodeDialectSolanaWalletAdapter.create(),
  }),
);

async function main() {
  await sdk.dapps.create({
    name: 'My test dapp',
    description: `My test dapp's description.`,
    blockchainType: BlockchainType.SOLANA,
  });
  const dapp = await sdk.dapps.find();

  // If all went well, you now have registered a dapp on Dialect Cloud!
  console.log(dapp);
}
main();
```

- Run the script to register the app

```
npx ts-node ./tmp/register-dialect-app.ts
```

The app is now registered on Dialect.

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://kamilmysliwiec.com)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](LICENSE).

```

```
