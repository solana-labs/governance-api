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
          const dbPort = process.env.DATABASE_PORT ? parseInt(process.env.DATABASE_PORT, 10) : 5432;

          const config: Config = {
            app: {
              port,
              host: process.env.HOST,
            },
            database: {
              host: process.env.DATABASE_HOST || '',
              name: process.env.DATABASE_NAME || '',
              password: process.env.DATABASE_PASSWORD,
              port: dbPort,
              username: process.env.DATABASE_USERNAME,
              useSsl: process.env.DATABASE_USE_SSL === 'true',
            },
            external: {
              twitterBearerKey: process.env.TWITTER_API_BEARER_KEY,
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
