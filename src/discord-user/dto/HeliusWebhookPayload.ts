import { ObjectType, Field } from '@nestjs/graphql';

class NativeTransfer {
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
  @Field(() => NativeTransfer, {
    description: 'Native transfers',
  })
  nativeTransfers: NativeTransfer[];
}
