import { Body, Controller, Logger, Post, Put } from '@nestjs/common';
import { PublicKey } from '@solana/web3.js';

import { DiscordUserService } from './discordUser.service';
import { HeliusWebhookPayload } from './dto/HeliusWebhookPayload';

@Controller()
export class DiscordUserController {
  private logger = new Logger(DiscordUserService.name);
  constructor(private readonly discordUserService: DiscordUserService) {}

  @Post('/webhook')
  async getHello(@Body() body: HeliusWebhookPayload[]): Promise<{ publicKeys: string[] }> {
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
  async updateHeliusWebhookAddresses(): Promise<{}> {
    await this.discordUserService.updateWebhookAddressList();
    return {};
  }
}
