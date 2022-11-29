import { Body, Controller, Logger, Post } from '@nestjs/common';
import { PublicKey } from '@solana/web3.js';

import { HeliusWebhookPayload } from './dto/HeliusWebhookPayload';
import { MatchdayDiscordUserService } from './matchdayDiscordUser.service';

@Controller()
export class MatchdayDiscordUserController {
  private logger = new Logger(MatchdayDiscordUserService.name);
  constructor(private readonly matchdayDiscordUserService: MatchdayDiscordUserService) {}

  @Post('/matchday-webhook')
  async getHello(@Body() body: HeliusWebhookPayload[]): Promise<{ publicKeys: string[] }> {
    const { type } = body[0];

    if (type === 'NFT_SALE') {
      const {
        events: {
          nft: { buyer, seller },
        },
      } = body[0];
      this.logger.verbose({ seller, buyer });

      await Promise.allSettled([
        this.matchdayDiscordUserService.updateMetadataForUser(new PublicKey(seller)),
        this.matchdayDiscordUserService.updateMetadataForUser(new PublicKey(buyer)),
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
          this.matchdayDiscordUserService.updateMetadataForUser(new PublicKey(address)),
        ),
      );

      return { publicKeys: Array.from(affectedAddresses) };
    }
    return { publicKeys: [] };
  }
}
