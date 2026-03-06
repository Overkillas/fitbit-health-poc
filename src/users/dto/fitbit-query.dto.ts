import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

export enum FitbitDetailLevel {
  ONE_MIN = '1min',
  FIFTEEN_MIN = '15min',
}

export enum HeartRateDetailLevel {
  ONE_SEC = '1sec',
  ONE_MIN = '1min',
}

export enum FitbitResource {
  STEPS = 'steps',
  DISTANCE = 'distance',
  CALORIES = 'calories',
  FLOORS = 'floors',
  ELEVATION = 'elevation',
  MINUTES_SEDENTARY = 'minutesSedentary',
  MINUTES_LIGHTLY_ACTIVE = 'minutesLightlyActive',
  MINUTES_FAIRLY_ACTIVE = 'minutesFairlyActive',
  MINUTES_VERY_ACTIVE = 'minutesVeryActive',
  ACTIVITY_CALORIES = 'activityCalories',
}

export class FitbitDateQueryDto {
  @IsDateString()
  @IsOptional()
  date?: string;
}

export class FitbitWeekQueryDto {
  @IsDateString()
  weekStart: string;
}

export class FitbitTimeSeriesQueryDto {
  @IsEnum(FitbitResource)
  resource: FitbitResource;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;
}

export class FitbitIntradayQueryDto {
  @IsEnum(FitbitResource)
  resource: FitbitResource;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsEnum(FitbitDetailLevel)
  @IsOptional()
  detailLevel?: FitbitDetailLevel;

  @IsString()
  @IsOptional()
  @Matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'startTime must be in HH:mm format',
  })
  startTime?: string;

  @IsString()
  @IsOptional()
  @Matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'endTime must be in HH:mm format',
  })
  endTime?: string;
}

export class FitbitDateRangeQueryDto {
  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;
}

export class FitbitHeartRateQueryDto {
  @IsDateString()
  date: string;

  @IsEnum(HeartRateDetailLevel)
  @IsOptional()
  detailLevel?: HeartRateDetailLevel;

  @IsString()
  @IsOptional()
  @Matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'startTime must be in HH:mm format',
  })
  startTime?: string;

  @IsString()
  @IsOptional()
  @Matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'endTime must be in HH:mm format',
  })
  endTime?: string;
}
