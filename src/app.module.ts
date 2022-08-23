import { join } from 'path';

import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { MercuriusDriver, MercuriusDriverConfig } from '@nestjs/mercurius';
import { TypeOrmModule } from '@nestjs/typeorm';
import mercurius from 'mercurius';

import { BigNumberScalar } from '@lib/scalars/BigNumber';
import { CursorScalar } from '@lib/scalars/Cursor';
import { PublicKeyScalar } from '@lib/scalars/PublicKey';
import { AppController } from '@src/app.controller';
import { AppService } from '@src/app.service';
import { AuthModule } from '@src/auth/auth.module';
import { ConfigModule } from '@src/config/config.module';
import { ConfigService } from '@src/config/config.service';
import { HolaplexModule } from '@src/holaplex/holaplex.module';
import { RealmFeedItemModule } from '@src/realm-feed-item/realm-feed-item.module';
import { RealmFeedModule } from '@src/realm-feed/realm-feed.module';
import { RealmMemberModule } from '@src/realm-member/realm-member.module';
import { RealmProposalModule } from '@src/realm-proposal/realm-proposal.module';
import { RealmSettingsModule } from '@src/realm-settings/realm-settings.module';
import { RealmModule } from '@src/realm/realm.module';
import { UserModule } from '@src/user/user.module';

import { RealmPostModule } from './realm-post/realm-post.module';

@Module({
  imports: [
    ConfigModule,
    GraphQLModule.forRoot<MercuriusDriverConfig>({
      autoSchemaFile: true,
      buildSchemaOptions: {
        dateScalarMode: 'timestamp',
      },
      driver: MercuriusDriver,
      persistedQueryProvider: mercurius.persistedQueryDefaults.automatic(),
      resolvers: {
        BigNumber: BigNumberScalar,
        Cursor: CursorScalar,
        PublicKey: PublicKeyScalar,
      },
      sortSchema: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        type: 'postgres',
        autoLoadEntities: true,
        database: configService.get('database.name'),
        entities: [join(__dirname, '/**/entity{.ts,.js}')],
        password: configService.get('database.password'),
        ssl: configService.get('database.useSsl') ? { rejectUnauthorized: true } : false,
        host: configService.get('database.host'),
        port: configService.get('database.port'),
        username: configService.get('database.username'),
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    UserModule,
    HolaplexModule,
    RealmModule,
    RealmMemberModule,
    RealmProposalModule,
    RealmFeedModule,
    RealmFeedItemModule,
    RealmSettingsModule,
    RealmPostModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
