import { Module } from '@nestjs/common';
import { FitbitService } from './fitbit.service';
import { FitbitController } from './fitbit.controller';

@Module({
  controllers: [FitbitController],
  providers: [FitbitService],
})
export class FitbitModule {}
