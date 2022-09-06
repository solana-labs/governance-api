import { CacheModule, Module } from '@nestjs/common';

import { TaskDedupeService } from './task-dedupe.service';

@Module({
  imports: [CacheModule.register()],
  providers: [TaskDedupeService],
  exports: [TaskDedupeService],
})
export class TaskDedupeModule {}
