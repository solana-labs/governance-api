import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { HeliusModule } from '@src/helius/helius.module';
import { Realm } from '@src/realm/entities/Realm.entity';

import { Tvl } from './entities/Tvl.entity';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';

@Module({
  imports: [HeliusModule, TypeOrmModule.forFeature([Realm, Tvl])],
  providers: [StatsService],
  controllers: [StatsController],
})
export class StatsModule {}
