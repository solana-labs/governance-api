import { Resolver, Mutation, Args } from '@nestjs/graphql';
import { PublicKey } from '@solana/web3.js';

import { EitherResolver } from '@src/lib/decorators/EitherResolver';
import { PublicKeyScalar } from '@src/lib/scalars/PublicKey';
import { SignatureScalar } from '@src/lib/scalars/Signature';

import { AuthService } from './auth.service';
import { AuthClaim } from './dto/AuthClaim';

@Resolver()
export class AuthResolver {
  constructor(private readonly authService: AuthService) {}

  @Mutation(() => AuthClaim)
  @EitherResolver()
  createAuthenticationClaim(
    @Args('publicKey', {
      description: 'The public key of the wallet',
      type: () => PublicKeyScalar,
    })
    publicKey: PublicKey
  ) {
    return this.authService.generateClaim(publicKey);
  }

  @Mutation(() => String)
  @EitherResolver()
  createAuthenticationToken(
    @Args('claim', {
      description: 'The authentication claim payload used to generate a token',
      type: () => String,
    })
    claim: string,
    @Args('signature', {
      description:
        "The auth claim signed by the public key's corresponding private key in hex representation",
      type: () => SignatureScalar,
    })
    signature: Buffer
  ) {
    return this.authService.verifyClaim(claim, signature);
  }
}
