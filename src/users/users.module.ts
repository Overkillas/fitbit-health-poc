import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { SyncHistory } from './entities/sync-history.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { FitbitModule } from '../fitbit/fitbit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, SyncHistory]),
    forwardRef(() => FitbitModule),
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
