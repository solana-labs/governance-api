import { CacheModule, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TaskDedupe } from './entities/TaskDedupe.entity';
import { TaskDedupeService } from './task-dedupe.service';

@Module({
  imports: [CacheModule.register(), TypeOrmModule.forFeature([TaskDedupe])],
  providers: [TaskDedupeService],
  exports: [TaskDedupeService],
})
export class TaskDedupeModule {}
