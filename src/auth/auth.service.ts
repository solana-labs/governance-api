import { randomBytes } from 'crypto';

import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { PublicKey } from '@solana/web3.js';
import { differenceInMinutes, isEqual } from 'date-fns';
import * as AR from 'fp-ts/Array';
import * as EI from 'fp-ts/Either';
import * as FN from 'fp-ts/function';
import * as OP from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import * as IT from 'io-ts';
import * as nacl from 'tweetnacl';
import { Repository } from 'typeorm';

import * as base64 from '@lib/base64';
import * as errors from '@lib/errors/gql';

import { Auth } from './entities/Auth.entity';
import { AuthClaim } from './entities/AuthClaim.entity';

const ClaimSentToClientCodec = IT.type({
  onBehalfOf: IT.string,
  nonce: IT.string,
  created: IT.number,
});

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Auth)
    private readonly authRepository: Repository<Auth>,
    @InjectRepository(AuthClaim)
    private readonly authClaimRepository: Repository<AuthClaim>,
    private readonly jwtService: JwtService
  ) {}

  /**
   * Creates an Auth for a Public Key
   */
  createAuthForPublicKey(publicKey: PublicKey) {
    return FN.pipe(
      this.authRepository.create({ data: {}, publicKeyStr: publicKey.toBase58() }),
      (auth) =>
        TE.tryCatch(
          () => this.authRepository.save(auth),
          (error) => (error instanceof Error ? error : new Error(String(error)))
        )
    );
  }

  /**
   * Removes existing authentication claims for a public key
   */
  destroyExistingClaims(publicKey: PublicKey): TE.TaskEither<Error, boolean> {
    return FN.pipe(
      TE.tryCatch(
        () => this.authClaimRepository.delete({ onBehalfOf: publicKey.toBase58() }),
        (error) => (error instanceof Error ? error : new Error(String(error)))
      ),
      TE.map(() => true)
    );
  }

  /**
   * Extracts the claim from a claim str
   */
  extractClaimFromClaimStr(claimStr: string) {
    return FN.pipe(
      claimStr,
      (str) => str.split(' '),
      AR.last,
      EI.fromOption(() => new errors.MalformedData()),
      EI.map(base64.decode),
      EI.chain((payload) =>
        EI.tryCatch(
          () => JSON.parse(payload),
          () => new errors.MalformedData()
        )
      ),
      EI.chainW(ClaimSentToClientCodec.decode),
      EI.map((clientClaim) => ({
        onBehalfOf: new PublicKey(clientClaim.onBehalfOf),
        nonce: clientClaim.nonce,
        created: new Date(clientClaim.created),
      }))
    );
  }

  /**
   * Returns an Auth if it exists
   */
  getAuthById(id: string): TE.TaskEither<Error, OP.Option<Auth>> {
    return FN.pipe(
      TE.tryCatch(
        () => this.authRepository.findOne({ where: { id } }),
        (error) => (error instanceof Error ? error : new Error(String(error)))
      ),
      TE.map((auth) => (auth ? OP.some(auth) : OP.none))
    );
  }

  /**
   * Returns an Auth if it exists
   */
  getAuthByPublicKey(publicKey: PublicKey): TE.TaskEither<Error, OP.Option<Auth>> {
    return FN.pipe(
      TE.tryCatch(
        () => this.authRepository.findOne({ where: { publicKeyStr: publicKey.toBase58() } }),
        (error) => (error instanceof Error ? error : new Error(String(error)))
      ),
      TE.map((auth) => (auth ? OP.some(auth) : OP.none))
    );
  }

  /**
   * Returns an Auth if it exists, otherwise creates one
   */
  getOrCreateAuthByPublicKey(publicKey: PublicKey) {
    return FN.pipe(
      this.getAuthByPublicKey(publicKey),
      TE.chain((auth) =>
        OP.isSome(auth) ? TE.right(auth.value) : this.createAuthForPublicKey(publicKey)
      )
    );
  }

  /**
   * Create a new authentication claim for a public key
   */
  generateClaim(publicKey: PublicKey) {
    return FN.pipe(
      this.destroyExistingClaims(publicKey),
      TE.map(() =>
        this.authClaimRepository.create({
          nonce: randomBytes(64).toString('hex'),
          onBehalfOf: publicKey.toBase58(),
        })
      ),
      TE.chain((claim) =>
        TE.tryCatch(
          () => this.authClaimRepository.save(claim),
          (error) => (error instanceof Error ? error : new Error(String(error)))
        )
      ),
      TE.map((claim) => {
        const payload = base64.encode(
          JSON.stringify({
            onBehalfOf: publicKey.toBase58(),
            nonce: claim.nonce,
            created: claim.created.getTime(),
          })
        );

        return {
          claim: [
            'Log in to Realms',
            '',
            `Log in time: ${claim.created.toISOString()}`,
            '',
            `On behalf of: ${publicKey.toBase58()}`,
            '',
            `Payload: ${payload}`,
          ].join('\n'),
          onBehalfOf: publicKey,
        };
      })
    );
  }

  /**
   * Get an existing authentication claim for a public key. If none
   * exists, return 'none';
   */
  getClaim(publicKey: PublicKey): TE.TaskEither<Error, OP.Option<AuthClaim>> {
    return FN.pipe(
      TE.tryCatch(
        () =>
          this.authClaimRepository.findOne({
            where: {
              onBehalfOf: publicKey.toBase58(),
            },
          }),
        (error) => (error instanceof Error ? error : new Error(String(error)))
      ),
      TE.map((claim) => (claim ? OP.some(claim) : OP.none))
    );
  }

  /**
   * Verifies a signed auth claim
   */
  verifyClaim(claimStr: string, signature: Buffer) {
    return FN.pipe(
      // First, convert the claim string into a claim object with all the properties
      this.extractClaimFromClaimStr(claimStr),
      TE.fromEither,
      TE.mapLeft(() => new errors.Unauthorized()),
      // Then, verify that the signture confirms that the right key was used to sign the claim
      TE.chain((decodedClaim) =>
        FN.pipe(
          nacl.sign.detached.verify(
            new TextEncoder().encode(claimStr),
            signature,
            decodedClaim.onBehalfOf.toBuffer()
          )
            ? TE.right(decodedClaim)
            : TE.left(new errors.Unauthorized()),
          TE.bindTo('claim'),
          // Next, find existing claims
          TE.bind('existingClaim', ({ claim }) => this.getClaim(claim.onBehalfOf)),
          // If there is no existing claim, consider this verification invaled
          TE.chain(({ existingClaim, claim }) =>
            OP.isNone(existingClaim)
              ? TE.left(new errors.Unauthorized())
              : TE.right({ claim, existingClaim: existingClaim.value })
          ),
          // The signed claim need to match the one and not be too old
          TE.chain(({ claim, existingClaim }) =>
            existingClaim.nonce !== claim.nonce ||
            !isEqual(existingClaim.created, claim.created) ||
            differenceInMinutes(Date.now(), existingClaim.created) > 10
              ? TE.left(new errors.Unauthorized())
              : TE.right({ claim, existingClaim })
          ),
          // If everything checks out, create a JWT
          TE.chainW(({ claim }) => this.getOrCreateAuthByPublicKey(claim.onBehalfOf)),
          TE.map((auth) => this.jwtService.sign({ sub: auth.id })),
          // Regardless of what happened, clean up by removing all existing claims saed in the db
          TE.matchW(
            (error) =>
              FN.pipe(
                this.destroyExistingClaims(decodedClaim.onBehalfOf),
                TE.chainW(() => TE.left(error))
              ),
            (jwt) =>
              FN.pipe(
                this.destroyExistingClaims(decodedClaim.onBehalfOf),
                TE.chainW(() => TE.right(jwt))
              )
          ),
          (te) => TE.fromTask<TE.TaskEither<Error, string>, Error>(te),
          TE.flatten
        )
      )
    );
  }
}
