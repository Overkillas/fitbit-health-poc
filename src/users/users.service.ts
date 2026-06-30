import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Not } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import * as bcrypt from 'bcrypt';
import { User, UserRole } from './entities/user.entity';
import { SyncHistory } from './entities/sync-history.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { FitbitService } from '../fitbit/fitbit.service';
import {
  FitbitActivityResponse,
  FitbitSleepResponse,
  FitbitHeartRateResponse,
  FitbitTimeSeriesResponse,
  FitbitIntradayResponse,
  FitbitProfileResponse,
  FitbitDeviceInfo,
  FitbitCardioScoreResponse,
  WeekDayData,
  WeekDayError,
  UserAllFitbitData,
  PatientFitbitResult,
} from '../fitbit/fitbit.types';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  private readonly SALT_ROUNDS = 10;

  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(SyncHistory)
    private readonly syncHistoryRepository: Repository<SyncHistory>,
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
    const bufferTime = 15 * 60 * 1000;

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

  async getUserActivityData(
    userId: number,
    date?: string,
  ): Promise<FitbitActivityResponse> {
    const user = await this.findByIdOrFail(userId);
    const accessToken = await this.getValidAccessToken(user);
    return this.fitbitService.getUserActivityData(accessToken, date);
  }

  async getUserSleepData(
    userId: number,
    date?: string,
  ): Promise<FitbitSleepResponse> {
    const user = await this.findByIdOrFail(userId);
    const accessToken = await this.getValidAccessToken(user);
    return this.fitbitService.getUserSleepData(accessToken, date);
  }

  async getUserWeekData(
    userId: number,
    weekStart: string,
  ): Promise<Array<WeekDayData | WeekDayError>> {
    const user = await this.findByIdOrFail(userId);
    const accessToken = await this.getValidAccessToken(user);
    return this.fitbitService.getWeekDataByDay(accessToken, weekStart);
  }

  async getUserTimeSeries(
    userId: number,
    resource: string,
    startDate: string,
    endDate: string,
  ): Promise<FitbitTimeSeriesResponse> {
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
  ): Promise<FitbitIntradayResponse> {
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
  ): Promise<FitbitHeartRateResponse> {
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
  ): Promise<PatientFitbitResult[]> {
    const results = await Promise.all(
      userIds.map(async (userId) => {
        try {
          let data:
            | FitbitActivityResponse
            | FitbitSleepResponse
            | Array<WeekDayData | WeekDayError>;
          switch (dataType) {
            case 'activity':
              data = await this.getUserActivityData(userId, params.date);
              break;
            case 'sleep':
              data = await this.getUserSleepData(userId, params.date);
              break;
            case 'week':
              if (!params.weekStart) {
                throw new BadRequestException(
                  'weekStart is required for week data',
                );
              }
              data = await this.getUserWeekData(userId, params.weekStart);
              break;
          }
          return { userId, userName: '', success: true, data };
        } catch (error) {
          return {
            userId,
            userName: '',
            success: false,
            error:
              error instanceof Error ? error.message : 'Failed to fetch data',
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
  ): Promise<PatientFitbitResult[]> {
    const patients = await this.findPatientsByDoctor(doctorId);
    const patientsWithFitbit = patients.filter((p) => p.fitbitAccessToken);
    const patientIds = patientsWithFitbit.map((p) => p.id);

    if (patientIds.length === 0) {
      return [];
    }

    return this.getMultipleUsersFitbitData(patientIds, dataType, params);
  }

  async getUserAllFitbitData(
    userId: number,
    date?: string,
  ): Promise<UserAllFitbitData> {
    const user = await this.findByIdOrFail(userId);
    const accessToken = await this.getValidAccessToken(user);
    const targetDate = date || new Date().toISOString().split('T')[0];

    const [activity, sleep, heartRate] = await Promise.all([
      this.fitbitService
        .getUserActivityData(accessToken, targetDate)
        .catch((e: Error) => ({ error: e.message })),
      this.fitbitService
        .getUserSleepData(accessToken, targetDate)
        .catch((e: Error) => ({ error: e.message })),
      this.fitbitService
        .getHeartRateIntraday(accessToken, targetDate, '1min')
        .catch((e: Error) => ({ error: e.message })),
    ]);

    return {
      userId,
      userName: user.name,
      date: targetDate,
      success: true,
      activity,
      sleep,
      heartRate,
    };
  }

  async getDoctorPatientsAllFitbitData(
    doctorId: number,
    date?: string,
  ): Promise<UserAllFitbitData[]> {
    const patients = await this.findPatientsByDoctor(doctorId);
    const patientsWithFitbit = patients.filter((p) => p.fitbitAccessToken);

    if (patientsWithFitbit.length === 0) {
      return [];
    }

    const results = await Promise.all(
      patientsWithFitbit.map(async (patient) => {
        try {
          return await this.getUserAllFitbitData(patient.id, date);
        } catch (error) {
          return {
            userId: patient.id,
            userName: patient.name,
            date: date || new Date().toISOString().split('T')[0],
            success: false,
            error:
              error instanceof Error ? error.message : 'Failed to fetch data',
            activity: { error: 'Failed to fetch' },
            sleep: { error: 'Failed to fetch' },
            heartRate: { error: 'Failed to fetch' },
          } as UserAllFitbitData;
        }
      }),
    );

    return results;
  }

  async getUserCardioScore(
    userId: number,
    startDate: string,
    endDate: string,
  ): Promise<FitbitCardioScoreResponse> {
    const user = await this.findByIdOrFail(userId);
    const accessToken = await this.getValidAccessToken(user);
    return this.fitbitService.getCardioScore(accessToken, startDate, endDate);
  }

  async getUserProfile(userId: number): Promise<FitbitProfileResponse> {
    const user = await this.findByIdOrFail(userId);
    const accessToken = await this.getValidAccessToken(user);
    return this.fitbitService.getUserProfile(accessToken);
  }

  async getDoctorPatientsProfiles(
    doctorId: number,
  ): Promise<PatientFitbitResult[]> {
    const patients = await this.findPatientsByDoctor(doctorId);
    const patientsWithFitbit = patients.filter((p) => p.fitbitAccessToken);

    if (patientsWithFitbit.length === 0) {
      return [];
    }

    const results = await Promise.all(
      patientsWithFitbit.map(async (patient) => {
        try {
          const data = await this.getUserProfile(patient.id);
          return {
            userId: patient.id,
            userName: patient.name,
            success: true,
            data,
          };
        } catch (error) {
          return {
            userId: patient.id,
            userName: patient.name,
            success: false,
            error:
              error instanceof Error
                ? error.message
                : 'Failed to fetch profile',
          };
        }
      }),
    );

    return results;
  }

  async getUserDevices(userId: number): Promise<FitbitDeviceInfo[]> {
    const user = await this.findByIdOrFail(userId);
    const accessToken = await this.getValidAccessToken(user);
    const devices = await this.fitbitService.getUserDevices(accessToken);

    // Salva sync history para cada dispositivo com lastSyncTime novo
    for (const device of devices) {
      if (device.lastSyncTime) {
        const syncTime = new Date(device.lastSyncTime);
        const deviceId = device.id || undefined;

        const lastEntry = await this.syncHistoryRepository.findOne({
          where: { userId, deviceId },
          order: { syncTime: 'DESC' },
        });

        const MIN_INTERVAL_MS = 30 * 60 * 1000;
        const isNewSync = !lastEntry || syncTime.getTime() > lastEntry.syncTime.getTime();
        const passedMinInterval = !lastEntry || (syncTime.getTime() - lastEntry.syncTime.getTime()) >= MIN_INTERVAL_MS;
        const batteryDrop = (lastEntry?.batteryLevel != null && device.batteryLevel != null)
          ? lastEntry.batteryLevel - device.batteryLevel
          : 0;
        const significantBatteryDrop = batteryDrop >= 5;

        if (isNewSync && (passedMinInterval || significantBatteryDrop)) {
          const entry = this.syncHistoryRepository.create({
            userId,
            syncTime,
            deviceId,
            deviceName: device.deviceVersion || undefined,
            deviceType: device.type || undefined,
            battery: device.battery || undefined,
            batteryLevel:
              device.batteryLevel !== undefined ? device.batteryLevel : undefined,
          });
          await this.syncHistoryRepository.save(entry);
        }
      }
    }

    return devices;
  }

  async getSyncHistory(
    userId: number,
    limit: number = 20,
  ): Promise<SyncHistory[]> {
    await this.findByIdOrFail(userId);
    return this.syncHistoryRepository.find({
      where: { userId },
      order: { syncTime: 'DESC' },
      take: limit,
    });
  }

  @Cron('0 */10 * * * *')
  async handleSyncCron() {
    this.logger.log('Checking Fitbit device sync status...');

    const connectedUsers = await this.usersRepository.find({
      where: { fitbitAccessToken: Not(IsNull()) },
    });

    if (connectedUsers.length === 0) {
      this.logger.log('No users with Fitbit connected.');
      return;
    }

    let synced = 0;
    for (const user of connectedUsers) {
      try {
        await this.getUserDevices(user.id);
        synced++;
      } catch (error) {
        this.logger.warn(
          `Failed to fetch devices for user ${user.id}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    this.logger.log(
      `Sync check completed: ${synced}/${connectedUsers.length} users verified.`,
    );
  }
}
