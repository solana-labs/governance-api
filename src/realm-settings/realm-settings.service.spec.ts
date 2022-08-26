import { Test, TestingModule } from '@nestjs/testing';

import { RealmSettingsService } from './realm-settings.service';

describe('RealmSettingsService', () => {
  let service: RealmSettingsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RealmSettingsService],
    }).compile();

    service = module.get<RealmSettingsService>(RealmSettingsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
