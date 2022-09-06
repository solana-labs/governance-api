import { Test, TestingModule } from '@nestjs/testing';

import { TaskDedupeService } from './task-dedupe.service';

describe('TaskDedupeService', () => {
  let service: TaskDedupeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TaskDedupeService],
    }).compile();

    service = module.get<TaskDedupeService>(TaskDedupeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
