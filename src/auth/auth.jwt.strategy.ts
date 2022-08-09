import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import * as FN from 'fp-ts/function';
import * as OP from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import { ExtractJwt, Strategy } from 'passport-jwt';

import * as errors from '@lib/errors/gql';
import { ConfigService } from '@src/config/config.service';

import { AuthService } from './auth.service';
import type { Auth } from './entities/Auth.entity';

@Injectable()
export class AuthJwtStrategy extends PassportStrategy(Strategy, 'authJwt') {
  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: configService.get('jwt.userSecret'),
    });
  }

  validate(payload: { sub: string; username: string }): Promise<Auth> {
    return FN.pipe(
      this.authService.getAuthById(payload.sub),
      TE.matchW(
        () => {
          throw new errors.Unauthorized();
        },
        (auth) => {
          if (OP.isNone(auth)) {
            throw new errors.Unauthorized();
          }

          return auth.value;
        }
      )
    )();
  }
}
