import { Exclude, Expose, Type } from 'class-transformer';
import { UserRole } from '../entities/user.entity';

@Exclude()
export class UserResponseDto {
  @Expose()
  id: number;

  @Expose()
  name: string;

  @Expose()
  email: string;

  @Expose()
  phone: string;

  @Expose()
  role: UserRole;

  @Expose()
  doctorId: number | null;

  @Expose()
  @Type(() => UserResponseDto)
  doctor?: UserResponseDto;

  @Expose()
  @Type(() => UserResponseDto)
  patients?: UserResponseDto[];

  @Expose()
  fitbitUserId: string | null;

  @Expose()
  hasFitbitConnected: boolean;
}
