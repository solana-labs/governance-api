import { CacheModule, Module } from '@nestjs/common';

import { RealmSettingsService } from './realm-settings.service';

@Module({
  imports: [CacheModule.register()],
  providers: [RealmSettingsService],
  exports: [RealmSettingsService],
})
export class RealmSettingsModule {}
