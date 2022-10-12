import { CacheModule, Module } from '@nestjs/common';

import { StaleCacheService } from './stale-cache.service';

@Module({
  imports: [CacheModule.register()],
  providers: [StaleCacheService],
  exports: [StaleCacheService],
})
export class StaleCacheModule {}
