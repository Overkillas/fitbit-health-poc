import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FitbitController } from './fitbit.controller';
import { FitbitService } from './fitbit.service';
import { SessionService } from './session.service';

@Module({
  imports: [ConfigModule],
  controllers: [FitbitController],
  providers: [FitbitService, SessionService],
  exports: [FitbitService],
})
export class FitbitModule {}
