import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { PublicKey } from '@solana/web3.js';
import * as FN from 'fp-ts/function';
import * as TE from 'fp-ts/TaskEither';
import { ExtractJwt, Strategy } from 'passport-jwt';

import * as errors from '@lib/errors/gql';
import { ConfigService } from '@src/config/config.service';
import { UserService } from '@src/user/user.service';

import { AuthService } from './auth.service';

@Injectable()
export class AuthJwtStrategy extends PassportStrategy(Strategy, 'authJwt') {
  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
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
      TE.chainW(TE.fromOption(() => new errors.Unauthorized())),
      TE.matchW(
        () => null,
        (user) => ({ ...user.data, publicKey: new PublicKey(user.publicKeyStr) }),
      ),
    )();
  }
}
