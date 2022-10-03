import { CacheModule, Module } from '@nestjs/common';

import { ConfigModule } from '@src/config/config.module';

import { RealmSettingsService } from './realm-settings.service';

@Module({
  imports: [CacheModule.register(), ConfigModule],
  providers: [RealmSettingsService],
  exports: [RealmSettingsService],
})
export class RealmSettingsModule {}
