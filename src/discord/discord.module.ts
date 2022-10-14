import { Module } from '@nestjs/common';

import { ConfigModule } from '@src/config/config.module';

import { DiscordService } from './discord.service';

@Module({
  imports: [ConfigModule],
  providers: [DiscordService],
  exports: [DiscordService],
})
export class DiscordModule {}
