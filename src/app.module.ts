import { join } from 'path';

import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { GraphQLModule } from '@nestjs/graphql';
import { MercuriusDriver, MercuriusDriverConfig } from '@nestjs/mercurius';
import { TypeOrmModule } from '@nestjs/typeorm';
import mercurius from 'mercurius';

import { BigNumberScalar } from '@lib/scalars/BigNumber';
import { CursorScalar } from '@lib/scalars/Cursor';
import { PublicKeyScalar } from '@lib/scalars/PublicKey';
import { RichTextDocumentScalar } from '@lib/scalars/RichTextDocument';
import { AppController } from '@src/app.controller';
import { AppService } from '@src/app.service';
import { AuthJwtInterceptor } from '@src/auth/auth.jwt.interceptor';
import { AuthModule } from '@src/auth/auth.module';
import { ConfigModule } from '@src/config/config.module';
import { ConfigService } from '@src/config/config.service';
import { DiscordUserModule } from '@src/discord-user/discordUser.module';
// import { DiscordModule } from '@src/discord/discord.module';
import { EcosystemFeedModule } from '@src/ecosystem-feed/ecosystem-feed.module';
import { RealmFeedItemCommentModule } from '@src/realm-feed-item-comment/realm-feed-item-comment.module';
import { RealmFeedItemModule } from '@src/realm-feed-item/realm-feed-item.module';
import { RealmFeedModule } from '@src/realm-feed/realm-feed.module';
import { RealmGovernanceModule } from '@src/realm-governance/realm-governance.module';
import { RealmHubModule } from '@src/realm-hub/realm-hub.module';
import { RealmMemberModule } from '@src/realm-member/realm-member.module';
import { RealmPostModule } from '@src/realm-post/realm-post.module';
import { RealmProposalModule } from '@src/realm-proposal/realm-proposal.module';
import { RealmSettingsModule } from '@src/realm-settings/realm-settings.module';
import { RealmTreasuryModule } from '@src/realm-treasury/realm-treasury.module';
import { RealmModule } from '@src/realm/realm.module';
import { StaleCacheModule } from '@src/stale-cache/stale-cache.module';
import { TaskDedupeModule } from '@src/task-dedupe/task-dedupe.module';
import { UserModule } from '@src/user/user.module';

import { DiscoverPageModule } from './discover-page/discover-page.module';
import { FollowFeedModule } from './follow-feed/follow-feed.module';
import { HeliusModule } from './helius/helius.module';
import { StatsModule } from './stats/stats.module';

//import { ScheduleModule } from '@nestjs/schedule';
//import { CronService } from '@src/discord-user/cronService.service';

@Module({
  imports: [
    //ScheduleModule.forRoot(),
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
        RichTextDocument: RichTextDocumentScalar,
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
    RealmModule,
    RealmMemberModule,
    RealmProposalModule,
    RealmFeedModule,
    RealmFeedItemModule,
    RealmSettingsModule,
    RealmPostModule,
    RealmTreasuryModule,
    RealmGovernanceModule,
    TaskDedupeModule,
    RealmFeedItemCommentModule,
    RealmHubModule,
    StaleCacheModule,
    // DiscordModule,
    DiscordUserModule,
    EcosystemFeedModule,
    FollowFeedModule,
    DiscoverPageModule,
    HeliusModule,
    StatsModule,
  ],
  controllers: [AppController],
  providers: [
    //CronService,
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: AuthJwtInterceptor,
    },
  ],
})
export class AppModule {}
