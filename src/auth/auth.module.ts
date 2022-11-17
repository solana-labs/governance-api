import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ConfigModule } from '@src/config/config.module';
import { ConfigService } from '@src/config/config.service';
import { UserModule } from '@src/user/user.module';

import { AuthJwtInterceptor } from './auth.jwt.interceptor';
import { AuthJwtStrategy } from './auth.jwt.strategy';
import { AuthResolver } from './auth.resolver';
import { AuthService } from './auth.service';
import { Auth } from './entities/Auth.entity';
import { AuthClaim } from './entities/AuthClaim.entity';

@Module({
  imports: [
    ConfigModule,
    PassportModule,
    UserModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get('jwt.userSecret'),
        signOptions: { expiresIn: '7d' },
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([Auth, AuthClaim]),
  ],
  providers: [AuthResolver, AuthService, AuthJwtInterceptor, AuthJwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
