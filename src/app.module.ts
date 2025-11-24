import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FitbitModule } from './fitbit/fitbit.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    FitbitModule,
  ],
})
export class AppModule {}
