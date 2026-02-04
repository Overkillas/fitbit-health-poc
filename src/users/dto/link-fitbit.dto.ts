import { IsDateString, IsNotEmpty, IsString } from 'class-validator';

export class LinkFitbitDto {
  @IsString()
  @IsNotEmpty()
  fitbitUserId: string;

  @IsString()
  @IsNotEmpty()
  accessToken: string;

  @IsString()
  @IsNotEmpty()
  refreshToken: string;

  @IsDateString()
  expiresAt: string;
}
