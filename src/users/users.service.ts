import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserRole } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { FitbitService } from '../fitbit/fitbit.service';

@Injectable()
export class UsersService {
  private readonly SALT_ROUNDS = 10;

  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly fitbitService: FitbitService,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    const existingEmail = await this.findByEmail(createUserDto.email);
    if (existingEmail) {
      throw new ConflictException('Email already exists');
    }

    const existingPhone = await this.usersRepository.findOne({
      where: { phone: createUserDto.phone },
    });
    if (existingPhone) {
      throw new ConflictException('Phone already exists');
    }

    if (createUserDto.role === UserRole.PATIENT && createUserDto.doctorId) {
      const doctor = await this.findById(createUserDto.doctorId);
      if (!doctor) {
        throw new NotFoundException('Doctor not found');
      }
      if (doctor.role !== UserRole.DOCTOR) {
        throw new BadRequestException('The specified user is not a doctor');
      }
    }

    const hashedPassword = await bcrypt.hash(
      createUserDto.password,
      this.SALT_ROUNDS,
    );

    const user = this.usersRepository.create({
      ...createUserDto,
      password: hashedPassword,
    });

    return this.usersRepository.save(user);
  }

  async findAll(): Promise<User[]> {
    return this.usersRepository.find({
      relations: ['doctor', 'patients'],
    });
  }

  async findAllDoctors(): Promise<User[]> {
    return this.usersRepository.find({
      where: { role: UserRole.DOCTOR },
      relations: ['patients'],
    });
  }

  async findAllPatients(): Promise<User[]> {
    return this.usersRepository.find({
      where: { role: UserRole.PATIENT },
      relations: ['doctor'],
    });
  }

  async findById(id: number): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { id },
      relations: ['doctor', 'patients'],
    });
  }

  async findByIdOrFail(id: number): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`);
    }
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

  async findByFitbitUserId(fitbitUserId: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { fitbitUserId } });
  }

  async findPatientsByDoctor(doctorId: number): Promise<User[]> {
    const doctor = await this.findById(doctorId);
    if (!doctor) {
      throw new NotFoundException(`Doctor with id ${doctorId} not found`);
    }
    if (doctor.role !== UserRole.DOCTOR) {
      throw new BadRequestException('User is not a doctor');
    }

    return this.usersRepository.find({
      where: { doctorId, role: UserRole.PATIENT },
    });
  }

  async update(id: number, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findByIdOrFail(id);

    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const existingEmail = await this.findByEmail(updateUserDto.email);
      if (existingEmail) {
        throw new ConflictException('Email already exists');
      }
    }

    if (updateUserDto.phone && updateUserDto.phone !== user.phone) {
      const existingPhone = await this.usersRepository.findOne({
        where: { phone: updateUserDto.phone },
      });
      if (existingPhone) {
        throw new ConflictException('Phone already exists');
      }
    }

    if (updateUserDto.doctorId) {
      const doctor = await this.findById(updateUserDto.doctorId);
      if (!doctor) {
        throw new NotFoundException('Doctor not found');
      }
      if (doctor.role !== UserRole.DOCTOR) {
        throw new BadRequestException('The specified user is not a doctor');
      }
    }

    if (updateUserDto.password) {
      updateUserDto.password = await bcrypt.hash(
        updateUserDto.password,
        this.SALT_ROUNDS,
      );
    }

    await this.usersRepository.update(id, updateUserDto);
    return this.findByIdOrFail(id);
  }

  async updateFitbitTokens(
    userId: number,
    tokens: {
      fitbitUserId: string;
      fitbitAccessToken: string;
      fitbitRefreshToken: string;
      fitbitTokenExpiresAt: Date;
    },
  ): Promise<User> {
    await this.findByIdOrFail(userId);
    await this.usersRepository.update(userId, tokens);
    return this.findByIdOrFail(userId);
  }

  async delete(id: number): Promise<void> {
    const user = await this.findByIdOrFail(id);

    if (user.role === UserRole.DOCTOR && user.patients?.length > 0) {
      throw new BadRequestException(
        'Cannot delete a doctor with associated patients',
      );
    }

    await this.usersRepository.delete(id);
  }

  async disconnectFitbit(userId: number): Promise<User> {
    await this.findByIdOrFail(userId);
    await this.usersRepository
      .createQueryBuilder()
      .update(User)
      .set({
        fitbitUserId: () => 'NULL',
        fitbitAccessToken: () => 'NULL',
        fitbitRefreshToken: () => 'NULL',
        fitbitTokenExpiresAt: () => 'NULL',
      })
      .where('id = :id', { id: userId })
      .execute();
    return this.findByIdOrFail(userId);
  }

  private async getValidAccessToken(user: User): Promise<string> {
    if (!user.fitbitAccessToken || !user.fitbitRefreshToken) {
      throw new BadRequestException('User has no Fitbit connected');
    }

    const now = new Date();
    const tokenExpiresAt = new Date(user.fitbitTokenExpiresAt);
    const bufferTime = 5 * 60 * 1000;

    if (tokenExpiresAt.getTime() - now.getTime() < bufferTime) {
      const refreshedTokens = await this.fitbitService.refreshAccessToken(
        user.fitbitRefreshToken,
      );

      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + refreshedTokens.expires_in);

      await this.updateFitbitTokens(user.id, {
        fitbitUserId: refreshedTokens.user_id,
        fitbitAccessToken: refreshedTokens.access_token,
        fitbitRefreshToken: refreshedTokens.refresh_token,
        fitbitTokenExpiresAt: expiresAt,
      });

      return refreshedTokens.access_token;
    }

    return user.fitbitAccessToken;
  }

  async getUserActivityData(userId: number, date?: string): Promise<any> {
    const user = await this.findByIdOrFail(userId);
    const accessToken = await this.getValidAccessToken(user);
    return this.fitbitService.getUserActivityData(accessToken, date);
  }

  async getUserSleepData(userId: number, date?: string): Promise<any> {
    const user = await this.findByIdOrFail(userId);
    const accessToken = await this.getValidAccessToken(user);
    return this.fitbitService.getUserSleepData(accessToken, date);
  }

  async getUserWeekData(userId: number, weekStart: string): Promise<any> {
    const user = await this.findByIdOrFail(userId);
    const accessToken = await this.getValidAccessToken(user);
    return this.fitbitService.getWeekDataByDay(accessToken, weekStart);
  }

  async getUserTimeSeries(
    userId: number,
    resource: string,
    startDate: string,
    endDate: string,
  ): Promise<any> {
    const user = await this.findByIdOrFail(userId);
    const accessToken = await this.getValidAccessToken(user);
    return this.fitbitService.getActivityTimeSeriesByDateRange(
      accessToken,
      resource,
      startDate,
      endDate,
    );
  }

  async getUserIntraday(
    userId: number,
    resource: string,
    startDate: string,
    endDate: string,
    detailLevel: '1min' | '15min' = '1min',
    startTime?: string,
    endTime?: string,
  ): Promise<any> {
    const user = await this.findByIdOrFail(userId);
    const accessToken = await this.getValidAccessToken(user);
    return this.fitbitService.getActivityIntradayByDateRange(
      accessToken,
      resource,
      startDate,
      endDate,
      detailLevel,
      startTime,
      endTime,
    );
  }

  async getUserHeartRateIntraday(
    userId: number,
    date: string,
    detailLevel: '1sec' | '1min' = '1min',
    startTime?: string,
    endTime?: string,
  ): Promise<any> {
    const user = await this.findByIdOrFail(userId);
    const accessToken = await this.getValidAccessToken(user);
    return this.fitbitService.getHeartRateIntraday(
      accessToken,
      date,
      detailLevel,
      startTime,
      endTime,
    );
  }

  async getMultipleUsersFitbitData(
    userIds: number[],
    dataType: 'activity' | 'sleep' | 'week',
    params: { date?: string; weekStart?: string },
  ): Promise<any[]> {
    const results = await Promise.all(
      userIds.map(async (userId) => {
        try {
          let data: any;
          switch (dataType) {
            case 'activity':
              data = await this.getUserActivityData(userId, params.date);
              break;
            case 'sleep':
              data = await this.getUserSleepData(userId, params.date);
              break;
            case 'week':
              if (!params.weekStart) {
                throw new BadRequestException('weekStart is required for week data');
              }
              data = await this.getUserWeekData(userId, params.weekStart);
              break;
          }
          return { userId, success: true, data };
        } catch (error) {
          return {
            userId,
            success: false,
            error: error.message || 'Failed to fetch data',
          };
        }
      }),
    );

    return results;
  }

  async getDoctorPatientsWithFitbitData(
    doctorId: number,
    dataType: 'activity' | 'sleep' | 'week',
    params: { date?: string; weekStart?: string },
  ): Promise<any[]> {
    const patients = await this.findPatientsByDoctor(doctorId);
    const patientsWithFitbit = patients.filter((p) => p.fitbitAccessToken);
    const patientIds = patientsWithFitbit.map((p) => p.id);

    if (patientIds.length === 0) {
      return [];
    }

    return this.getMultipleUsersFitbitData(patientIds, dataType, params);
  }

  async getUserAllFitbitData(userId: number, date?: string): Promise<any> {
    const user = await this.findByIdOrFail(userId);
    const accessToken = await this.getValidAccessToken(user);
    const targetDate = date || new Date().toISOString().split('T')[0];

    const [activity, sleep, heartRate] = await Promise.all([
      this.fitbitService.getUserActivityData(accessToken, targetDate).catch((e) => ({ error: e.message })),
      this.fitbitService.getUserSleepData(accessToken, targetDate).catch((e) => ({ error: e.message })),
      this.fitbitService.getHeartRateIntraday(accessToken, targetDate, '1min').catch((e) => ({ error: e.message })),
    ]);

    return {
      userId,
      userName: user.name,
      date: targetDate,
      activity,
      sleep,
      heartRate,
    };
  }

  async getDoctorPatientsAllFitbitData(
    doctorId: number,
    date?: string,
  ): Promise<any[]> {
    const patients = await this.findPatientsByDoctor(doctorId);
    const patientsWithFitbit = patients.filter((p) => p.fitbitAccessToken);

    if (patientsWithFitbit.length === 0) {
      return [];
    }

    const results = await Promise.all(
      patientsWithFitbit.map(async (patient) => {
        try {
          const data = await this.getUserAllFitbitData(patient.id, date);
          return { ...data, success: true };
        } catch (error) {
          return {
            userId: patient.id,
            userName: patient.name,
            success: false,
            error: error.message || 'Failed to fetch data',
          };
        }
      }),
    );

    return results;
  }
}
