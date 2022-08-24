import { Module } from '@nestjs/common';

import { RealmTreasuryService } from './realm-treasury.service';

@Module({
  providers: [RealmTreasuryService],
})
export class RealmTreasuryModule {}
