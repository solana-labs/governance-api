import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { RealmMemberModule } from '@src/realm-member/realm-member.module';

import { User } from './entities/User.entity';
import { UserResolver } from './user.resolver';
import { UserService } from './user.service';

@Module({
  imports: [TypeOrmModule.forFeature([User]), RealmMemberModule],
  providers: [UserResolver, UserService],
  exports: [UserService],
})
export class UserModule {}
