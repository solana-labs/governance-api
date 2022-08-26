import { CacheModule, Module } from '@nestjs/common';

import { RealmSettingsModule } from '@src/realm-settings/realm-settings.module';

import { OnChainService } from './on-chain.service';

@Module({
  imports: [CacheModule.register(), RealmSettingsModule],
  providers: [OnChainService],
  exports: [OnChainService],
})
export class OnChainModule {}
