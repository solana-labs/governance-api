import { Module } from '@nestjs/common';

import { HolaplexService } from './holaplex.service';

@Module({
  providers: [HolaplexService],
  exports: [HolaplexService],
})
export class HolaplexModule {}
