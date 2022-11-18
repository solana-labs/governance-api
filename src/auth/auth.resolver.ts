import { Resolver, Mutation, Args } from '@nestjs/graphql';
import { PublicKey } from '@solana/web3.js';
import * as FN from 'fp-ts/function';
import * as TE from 'fp-ts/TaskEither';

import { EitherResolver } from '@src/lib/decorators/EitherResolver';
import { PublicKeyScalar } from '@src/lib/scalars/PublicKey';
import { SignatureScalar } from '@src/lib/scalars/Signature';

import { AuthService } from './auth.service';
import { AuthClaim } from './dto/AuthClaim';
import { VerifyWallet } from '@src/discord-user/dto/VerifyWallet';

@Resolver()
export class AuthResolver {
  constructor(private readonly authService: AuthService) {}

  @Mutation(() => AuthClaim, {
    description:
      'Generate an authentication claim that a wallet can sign and trade for an auth token',
  })
  @EitherResolver()
  createAuthenticationClaim(
    @Args('publicKey', {
      description: 'The public key of the wallet',
      type: () => PublicKeyScalar,
    })
    publicKey: PublicKey,
  ) {
    return this.authService.generateClaim(publicKey);
  }

  @Mutation(() => String, {
    description: 'Trade a signed authentication claim for an auth token',
  })
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
    signature: Buffer,
  ) {
    return FN.pipe(
      this.authService.verifyClaim(claim, signature),
      TE.map((user) => this.authService.generateJWT(user)),
    );
  }
}
