import { ObjectType, Field } from '@nestjs/graphql';

@ObjectType({
  description: 'Status on the wallet verification',
})
export class VerifyWallet {
  @Field({ description: 'Status of the connection between the Discord user and the wallet' })
  status: string;
}
