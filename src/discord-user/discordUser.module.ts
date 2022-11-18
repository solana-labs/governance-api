import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DiscordUserController } from './discordUser.controller';
import { DiscordUserResolver } from './discordUser.resolver';
import { DiscordUserService } from './discordUser.service';
import { DiscordUser } from './entities/DiscordUser.entity';

@Module({
  imports: [TypeOrmModule.forFeature([DiscordUser])],
  controllers: [DiscordUserController],
  providers: [DiscordUserResolver, DiscordUserService],
  exports: [DiscordUserService],
})
export class DiscordUserModule {}
