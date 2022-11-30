import { ObjectType, Field } from '@nestjs/graphql';

class HeliusTransfer {
  @Field()
  amount: number;
  @Field()
  fromUserAccount: string;
  @Field()
  toUserAccount: string;
}

@ObjectType({
  description: 'A Helius webhook payload',
})
export class HeliusWebhookPayload {
  @Field(() => HeliusTransfer, {
    description: 'Native transfers',
  })
  nativeTransfers: HeliusTransfer[];

  @Field(() => HeliusTransfer, {
    description: 'Token transfers',
  })
  tokenTransfers: HeliusTransfer[];

  @Field()
  type: 'TRANSFER' | 'NFT_SALE';

  @Field()
  signature: string;

  @Field()
  events: { nft: { buyer: string; seller: string } };
}
