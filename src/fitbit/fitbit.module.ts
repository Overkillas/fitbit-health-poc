import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FitbitController } from './fitbit.controller';
import { FitbitService } from './fitbit.service';
import { SessionService } from './session.service';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [ConfigModule, forwardRef(() => UsersModule)],
  controllers: [FitbitController],
  providers: [FitbitService, SessionService],
  exports: [FitbitService],
})
export class FitbitModule {}
