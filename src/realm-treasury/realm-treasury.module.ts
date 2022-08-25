import { CacheModule, Module } from '@nestjs/common';

import { OnChainModule } from '@src/on-chain/on-chain.module';

import { RealmTreasuryResolver } from './realm-treasury.resolver';
import { RealmTreasuryService } from './realm-treasury.service';

@Module({
  imports: [CacheModule.register(), OnChainModule],
  providers: [RealmTreasuryService, RealmTreasuryResolver],
})
export class RealmTreasuryModule {}
