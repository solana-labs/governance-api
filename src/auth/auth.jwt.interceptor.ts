import { NestInterceptor, ExecutionContext, Injectable, CallHandler } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { PublicKey } from '@solana/web3.js';
import * as EI from 'fp-ts/Either';
import * as OP from 'fp-ts/Option';
import * as jsonwebtoken from 'jsonwebtoken';
import { ExtractJwt } from 'passport-jwt';

import { ConfigService } from '@src/config/config.service';
import { UserService } from '@src/user/user.service';

@Injectable()
export class AuthJwtInterceptor implements NestInterceptor {
  constructor(
    private readonly configService: ConfigService,
    private readonly userService: UserService,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler<any>) {
    const ctx = GqlExecutionContext.create(context);
    const request = ctx.getContext().req;
    const rawAuthToken = ExtractJwt.fromAuthHeaderAsBearerToken()(request);

    try {
      if (rawAuthToken) {
        const token = jsonwebtoken.verify(rawAuthToken, this.configService.get('jwt.userSecret'));
        const userId = token.sub;

        if (typeof userId === 'string') {
          const result = await this.userService.getUserById(userId)();

          if (EI.isRight(result)) {
            const user = OP.isSome(result.right) ? result.right.value : null;

            if (user) {
              request.user = {
                ...user.data,
                id: user.id,
                publicKey: new PublicKey(user.publicKeyStr),
              };
            }
          }
        }
      }
    } catch (e) {
      console.log(e);
    }
    return next.handle();
  }
}
