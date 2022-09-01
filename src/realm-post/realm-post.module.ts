import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { RealmPost } from './entities/RealmPost.entity';
import { RealmPostResolver } from './realm-post.resolver';
import { RealmPostService } from './realm-post.service';

@Module({
  imports: [TypeOrmModule.forFeature([RealmPost])],
  providers: [RealmPostResolver, RealmPostService],
  exports: [RealmPostService],
})
export class RealmPostModule {}
