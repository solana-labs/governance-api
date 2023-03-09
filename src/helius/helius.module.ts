import { Module } from '@nestjs/common';

import { ConfigModule } from '@src/config/config.module';
import { RealmSettingsModule } from '@src/realm-settings/realm-settings.module';
import { StaleCacheModule } from '@src/stale-cache/stale-cache.module';

import { HeliusService } from './helius.service';

@Module({
  imports: [ConfigModule, RealmSettingsModule, StaleCacheModule],
  providers: [HeliusService],
  exports: [HeliusService],
})
export class HeliusModule {}
