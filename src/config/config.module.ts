import { Module } from '@nestjs/common';
import { ConfigModule as _ConfigModule } from '@nestjs/config';

import type { Config } from './config.service';
import { ConfigService } from './config.service';

@Module({
  imports: [
    _ConfigModule.forRoot({
      envFilePath: '.env',
      load: [
        () => {
          const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

          const config: Config = {
            app: {
              port,
              host: process.env.HOST || undefined,
            },
            database: {
              password: process.env.DATABASE_PASSWORD,
              url: process.env.DATABASE_URL || '',
              username: process.env.DATABASE_USERNAME,
              useSsl: process.env.DATABASE_USE_SSL === 'true',
            },
            jwt: {
              userSecret: process.env.JWT_USER_SECRET || '',
            },
          };

          return config;
        },
      ],
    }),
  ],
  providers: [ConfigService],
  exports: [ConfigService],
})
export class ConfigModule {}
