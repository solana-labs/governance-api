import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { PublicKey } from '@solana/web3.js';
import * as FN from 'fp-ts/function';
import * as OP from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { ConfigService } from '@src/config/config.service';
import { UserService } from '@src/user/user.service';

@Injectable()
export class AuthJwtStrategy extends PassportStrategy(Strategy, 'authJwt') {
  constructor(
    private readonly configService: ConfigService,
    private readonly userService: UserService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: configService.get('jwt.userSecret'),
    });
  }

  validate(payload: { sub: string }) {
    return FN.pipe(
      this.userService.getUserById(payload.sub),
      TE.matchW(
        () => null,
        (user) =>
          OP.isSome(user)
            ? {
                ...user.value.data,
                id: user.value.id,
                publicKey: new PublicKey(user.value.publicKeyStr),
              }
            : null,
      ),
    )();
  }
}
