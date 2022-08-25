import { CacheModule, Module } from '@nestjs/common';

import { OnChainModule } from '@src/on-chain/on-chain.module';

import { RealmTreasuryService } from './realm-treasury.service';
import { RealmTreasuryResolver } from './realm-treasury.resolver';

@Module({
  imports: [CacheModule.register(), OnChainModule],
  providers: [RealmTreasuryService, RealmTreasuryResolver],
})
export class RealmTreasuryModule {}
