import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ConfigModule } from '@src/config/config.module';

import { DiscordUserController } from './discordUser.controller';
import { DiscordUserResolver } from './discordUser.resolver';
import { DiscordUserService } from './discordUser.service';
import { DiscordUser } from './entities/DiscordUser.entity';
import { MatchdayDiscordUser } from './entities/MatchdayDiscordUser.entity';
import { MatchdayDiscordUserService } from './matchdayDiscordUser.service';

@Module({
  imports: [TypeOrmModule.forFeature([DiscordUser, MatchdayDiscordUser]), ConfigModule],
  controllers: [DiscordUserController],
  providers: [DiscordUserResolver, DiscordUserService, MatchdayDiscordUserService],
  exports: [DiscordUserService],
})
export class DiscordUserModule {}
