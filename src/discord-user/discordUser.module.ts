import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ConfigModule } from '@src/config/config.module';

import { DiscordUserController } from './discordUser.controller';
import { DiscordUserResolver } from './discordUser.resolver';
import { DiscordUserService } from './discordUser.service';
import { DiscordUser } from './entities/DiscordUser.entity';
import { MatchdayDiscordUser } from './entities/MatchdayDiscordUser.entity';
import { MatchdayDiscordUserController } from './matchdayDiscordUser.controller';
import { MatchdayDiscordUserService } from './matchdayDiscordUser.service';
import { ValidatorDiscordUser } from './entities/ValidatorDiscordUser.entity';
import { ValidatorDiscordUserController } from './validator-discord-user.controller';
import { ValidatorDiscordUserService } from './validator-discord-user.service';

@Module({
  imports: [TypeOrmModule.forFeature([DiscordUser, MatchdayDiscordUser, ValidatorDiscordUser]), ConfigModule],
  controllers: [DiscordUserController, MatchdayDiscordUserController, ValidatorDiscordUserController],
  providers: [DiscordUserResolver, DiscordUserService, MatchdayDiscordUserService, ValidatorDiscordUserService],
  exports: [DiscordUserService],
})
export class DiscordUserModule {}
