import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpException,
  HttpStatus,
  Logger,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { Connection, PublicKey } from '@solana/web3.js';
import { Request } from 'express';
import * as nacl from 'tweetnacl';

import { ConfigService } from '@src/config/config.service';

import { DiscordInteractionPayload } from './dto/DiscordInteractionPayload';
import { HeliusWebhookPayload } from './dto/HeliusWebhookPayload';
import { MatchdayDiscordUserService } from './matchdayDiscordUser.service';

const DELAY_DURATION = 15_000;

const connection = new Connection(process.env.RPC_ENDPOINT as string);

@Controller()
export class MatchdayDiscordUserController {
  private logger = new Logger(MatchdayDiscordUserService.name);
  constructor(
    private readonly matchdayDiscordUserService: MatchdayDiscordUserService,
    private readonly configService: ConfigService,
  ) {} 

  @Post('/matchday/verify-command')
  @HttpCode(200)
  async verifyCommand(
    @Body() body: DiscordInteractionPayload,
    @Headers() headers,
    @Req() req: Request,
    @Res() res,
  ) {
    // Your public key can be found on your application in the Developer Portal
    const PUBLIC_KEY =
      this.matchdayDiscordUserService.getDiscordApplicationCredentials().public_key;

    const signature = headers['x-signature-ed25519'];
    const timestamp = headers['x-signature-timestamp'];

    if (timestamp && signature) {
      const isVerified = nacl.sign.detached.verify(
        Buffer.from(timestamp + JSON.stringify(req.body)),
        Buffer.from(signature, 'hex'),
        Buffer.from(PUBLIC_KEY, 'hex'),
      );

      if (!isVerified) {
        return res.status(HttpStatus.UNAUTHORIZED).send('invalid request signature');
      }

      if (body.type === 1 /* PING */) {
        console.info('ACK');
        res.status(HttpStatus.OK).send({ type: 1 }); /* PONG */
        return;
      }

      if (body.type === 2 && body.data.name === 'verify') {
        res.status(HttpStatus.OK).send({
          type: 4,
          data: {
            tts: false,
            content:
              'Verify and link your Solana wallet at https://app.realms.today/matchday/verify-wallet in order to qualify for roles in this server',
            embeds: [],
            allowed_mentions: { parse: [] },
            // Sends an ephemeral message that only the sender can see.
            flags: 1 << 6,
          },
        });
        return;
      }
    }
    return res.status(HttpStatus.UNAUTHORIZED).send('invalid request signature');
  }

  @Post('/matchday-webhook')
  async getHello(
    @Body() body: HeliusWebhookPayload[],
    @Headers() headers,
  ): Promise<{ publicKeys: string[] }> {
    if (headers['authorization'] !== this.configService.get('helius.webhookKey')) {
      throw new HttpException('Forbidden', HttpStatus.UNAUTHORIZED);
    }

    const { type, signature } = body[0];

    const blockhash = await connection.getLatestBlockhash('finalized');
    const tx = await connection.getTransaction(signature, {
      commitment: 'finalized',
      maxSupportedTransactionVersion: 1,
    });
    if (!tx) {
      await connection.confirmTransaction({ ...blockhash, signature }, 'finalized');
    }

    if (type === 'NFT_SALE') {
      const {
        events: {
          nft: { buyer, seller },
        },
      } = body[0];
      this.logger.verbose({ seller, buyer });

      await Promise.allSettled([
        this.matchdayDiscordUserService.updateMetadataForUser(
          new PublicKey(seller),
          null,
          DELAY_DURATION,
        ),
        this.matchdayDiscordUserService.updateMetadataForUser(
          new PublicKey(buyer),
          null,
          DELAY_DURATION,
        ),
      ]);

      return { publicKeys: [seller, buyer] };
    } else if (type === 'TRANSFER') {
      const { tokenTransfers } = body[0];
      const affectedAddresses = new Set<string>();
      tokenTransfers.forEach((transfer) => {
        affectedAddresses.add(transfer.fromUserAccount);
        affectedAddresses.add(transfer.toUserAccount);
      });
      this.logger.verbose({ affectedAddresses: Array.from(affectedAddresses) });

      await Promise.allSettled(
        Array.from(affectedAddresses).map((address) =>
          this.matchdayDiscordUserService.updateMetadataForUser(
            new PublicKey(address),
            null,
            DELAY_DURATION,
          ),
        ),
      );

      return { publicKeys: Array.from(affectedAddresses) };
    }
    return { publicKeys: [] };
  }
}
