import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpException,
  HttpStatus,
  Logger,
  Post,
  Put,
  Req,
  Res,
} from '@nestjs/common';
import { PublicKey } from '@solana/web3.js';
import * as nacl from 'tweetnacl';

import { ConfigService } from '@src/config/config.service';

import { DiscordUserService } from './discordUser.service';
import { DiscordInteractionPayload } from './dto/DiscordInteractionPayload';
import { HeliusWebhookPayload } from './dto/HeliusWebhookPayload';

@Controller()
export class DiscordUserController {
  private logger = new Logger(DiscordUserService.name);
  constructor(
    private readonly discordUserService: DiscordUserService,
    private readonly configService: ConfigService,
  ) {}

  @Post('/verify-command')
  @HttpCode(200)
  async verifyCommand(
    @Body() body: DiscordInteractionPayload,
    @Headers() headers,
    @Req() req: Request,
    @Res() res,
  ) {
    // Your public key can be found on your application in the Developer Portal
    const PUBLIC_KEY = this.discordUserService.getDiscordApplicationCredentials().public_key;

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
              'Verify and link your Solana wallet at https://app.realms.today/verify-wallet in order to qualify for roles in this server',
            embeds: [],
            allowed_mentions: { parse: [] },
            flags: 1 << 6,
          },
        });
        return;
      }
    }
    return res.status(HttpStatus.UNAUTHORIZED).send('invalid request signature');
  }

  @Post('/webhook')
  async getHello(
    @Body() body: HeliusWebhookPayload[],
    @Headers() headers,
  ): Promise<{ publicKeys: string[] }> {
    if (headers['authorization'] !== this.configService.get('helius.webhookKey')) {
      throw new HttpException('Forbidden', HttpStatus.UNAUTHORIZED);
    }

    const { nativeTransfers } = body[0];
    const affectedAddresses = new Set<string>();
    nativeTransfers.forEach((transfer) => {
      affectedAddresses.add(transfer.fromUserAccount);
      affectedAddresses.add(transfer.toUserAccount);
    });
    this.logger.verbose({ affectedAddresses: Array.from(affectedAddresses) });

    for await (const affectedAddress of affectedAddresses) {
      try {
        await this.discordUserService.updateMetadataForUser(
          new PublicKey(affectedAddress),
          null, // Delay update of Discord data by 10s to allow balance changes to update in Helius RPC
          10 * 1000,
        );
      } catch (e) {
        this.logger.error(e);
      }
    }

    return { publicKeys: Array.from(affectedAddresses) };
  }

  @Put('/webhook-update')
  async updateHeliusWebhookAddresses() {
    await this.discordUserService.updateWebhookAddressList();
    return {};
  }
}
