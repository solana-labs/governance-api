import { ObjectType, Field } from '@nestjs/graphql';

class NativeTransfer {
  @Field()
  amount: number;
  @Field()
  fromUserAccount: string;
  @Field()
  toUserAccount: string;
}

class AccountData {
  @Field()
  account: string;
  @Field()
  nativeBalanceChange: number;
}

@ObjectType({
  description: 'A Helius webhook payload',
})
export class HeliusWebhookPayload {
  @Field(() => NativeTransfer, {
    description: 'Native transfers',
  })
  nativeTransfers: NativeTransfer[];
  accountData: AccountData[];
}
