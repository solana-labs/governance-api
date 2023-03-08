import { Module } from '@nestjs/common';

import { ConfigModule } from '@src/config/config.module';
import { RealmSettingsModule } from '@src/realm-settings/realm-settings.module';

import { HeliusService } from './helius.service';

@Module({
  imports: [ConfigModule, RealmSettingsModule],
  providers: [HeliusService],
  exports: [HeliusService],
})
export class HeliusModule {}
