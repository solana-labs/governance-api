import { Body, Controller, Get, Post, Put } from '@nestjs/common';
import { PublicKey } from '@solana/web3.js';

import { DiscordUserService } from './discordUser.service';
import { HeliusWebhookPayload } from './dto/HeliusWebhookPayload';

@Controller()
export class DiscordUserController {
  constructor(private readonly discordUserService: DiscordUserService) {}

  @Post('/webhook')
  async getHello(@Body() body: HeliusWebhookPayload[]): Promise<{ publicKeys: string[] }> {
    const { nativeTransfers } = body[0];
    const affectedAddresses = new Set<string>();
    nativeTransfers.forEach((transfer) => {
      affectedAddresses.add(transfer.fromUserAccount);
      affectedAddresses.add(transfer.toUserAccount);
    });
    console.info({ affectedAddresses });

    for await (const affectedAddress of affectedAddresses) {
      await this.discordUserService.refreshDiscordMetadataForPublicKey(
        new PublicKey(affectedAddress),
      );
    }

    return { publicKeys: Array.from(affectedAddresses) };
  }

  @Put('/webhook-update')
  async updateHeliusWebhookAddresses(): Promise<{}> {
    console.log("Updating web hook...");
    await this.discordUserService.updateWebhookAddressList();
    console.log("Updated!");
    return {};
  }
}
