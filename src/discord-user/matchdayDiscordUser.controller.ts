import { Body, Controller, Logger, Post } from '@nestjs/common';
import { Connection, PublicKey } from '@solana/web3.js';

import { HeliusWebhookPayload } from './dto/HeliusWebhookPayload';
import { MatchdayDiscordUserService } from './matchdayDiscordUser.service';

const DELAY_DURATION = 25_000;

const connection = new Connection(process.env.RPC_ENDPOINT as string);

@Controller()
export class MatchdayDiscordUserController {
  private logger = new Logger(MatchdayDiscordUserService.name);
  constructor(private readonly matchdayDiscordUserService: MatchdayDiscordUserService) {}

  @Post('/matchday-webhook')
  async getHello(@Body() body: HeliusWebhookPayload[]): Promise<{ publicKeys: string[] }> {
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
