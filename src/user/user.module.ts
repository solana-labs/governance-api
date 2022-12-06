import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ConfigModule } from '@src/config/config.module';
import { RealmMemberModule } from '@src/realm-member/realm-member.module';
import { RealmModule } from '@src/realm/realm.module';

import { User } from './entities/User.entity';
import { UserResolver } from './user.resolver';
import { UserService } from './user.service';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([User]),
    RealmMemberModule,
    forwardRef(() => RealmModule),
  ],
  providers: [UserResolver, UserService],
  exports: [UserService],
})
export class UserModule {}
