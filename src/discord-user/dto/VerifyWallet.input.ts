import { InputType, Field } from '@nestjs/graphql';

@InputType({
  description: 'Verify a wallet to link a Discord account to a user',
})
export class VerifyWalletInput {
  @Field({ description: 'The Discord authorization code for this user' })
  code: string;
}
