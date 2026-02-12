import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import {
  FitbitDateQueryDto,
  FitbitWeekQueryDto,
  FitbitTimeSeriesQueryDto,
  FitbitIntradayQueryDto,
  FitbitHeartRateQueryDto,
  FitbitDetailLevel,
  HeartRateDetailLevel,
} from './dto/fitbit-query.dto';
import { LinkFitbitDto } from './dto/link-fitbit.dto';
import { User } from './entities/user.entity';

interface SanitizedUser {
  id: number;
  name: string;
  email: string;
  phone: string;
  role: string;
  doctorId: number;
  fitbitUserId: string;
  hasFitbitConnected: boolean;
  doctor?: SanitizedUser;
  patients?: SanitizedUser[];
}

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // ================================
  // CRUD ENDPOINTS
  // ================================

  @Post()
  async create(@Body() createUserDto: CreateUserDto) {
    const user = await this.usersService.create(createUserDto);
    return this.sanitizeUser(user);
  }

  @Get()
  async findAll() {
    const users = await this.usersService.findAll();
    return users.map((user) => this.sanitizeUser(user));
  }

  @Get('doctors')
  async findAllDoctors() {
    const doctors = await this.usersService.findAllDoctors();
    return doctors.map((doctor) => this.sanitizeUser(doctor));
  }

  @Get('patients')
  async findAllPatients() {
    const patients = await this.usersService.findAllPatients();
    return patients.map((patient) => this.sanitizeUser(patient));
  }

  @Get(':id')
  async findById(@Param('id', ParseIntPipe) id: number) {
    const user = await this.usersService.findByIdOrFail(id);
    return this.sanitizeUser(user);
  }

  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    const user = await this.usersService.update(id, updateUserDto);
    return this.sanitizeUser(user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id', ParseIntPipe) id: number) {
    await this.usersService.delete(id);
  }

  // ================================
  // DOCTOR -> PATIENTS ENDPOINTS
  // ================================

  @Get(':id/patients')
  async findPatientsByDoctor(@Param('id', ParseIntPipe) id: number) {
    const patients = await this.usersService.findPatientsByDoctor(id);
    return patients.map((patient) => this.sanitizeUser(patient));
  }

  @Get(':id/patients/fitbit/activity')
  async getDoctorPatientsActivity(
    @Param('id', ParseIntPipe) doctorId: number,
    @Query() query: FitbitDateQueryDto,
  ) {
    return this.usersService.getDoctorPatientsWithFitbitData(
      doctorId,
      'activity',
      { date: query.date },
    );
  }

  @Get(':id/patients/fitbit/sleep')
  async getDoctorPatientsSleep(
    @Param('id', ParseIntPipe) doctorId: number,
    @Query() query: FitbitDateQueryDto,
  ) {
    return this.usersService.getDoctorPatientsWithFitbitData(
      doctorId,
      'sleep',
      {
        date: query.date,
      },
    );
  }

  @Get(':id/patients/fitbit/week')
  async getDoctorPatientsWeek(
    @Param('id', ParseIntPipe) doctorId: number,
    @Query() query: FitbitWeekQueryDto,
  ) {
    return this.usersService.getDoctorPatientsWithFitbitData(doctorId, 'week', {
      weekStart: query.weekStart,
    });
  }

  @Get(':id/patients/fitbit/profile')
  async getDoctorPatientsProfile(@Param('id', ParseIntPipe) doctorId: number) {
    return this.usersService.getDoctorPatientsProfiles(doctorId);
  }

  @Get(':id/patients/fitbit/all')
  async getDoctorPatientsAllData(
    @Param('id', ParseIntPipe) doctorId: number,
    @Query() query: FitbitDateQueryDto,
  ) {
    return this.usersService.getDoctorPatientsAllFitbitData(
      doctorId,
      query.date,
    );
  }

  // ================================
  // FITBIT DATA ENDPOINTS (SINGLE USER)
  // ================================

  @Get(':id/fitbit/activity')
  async getUserActivity(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: FitbitDateQueryDto,
  ) {
    return this.usersService.getUserActivityData(id, query.date);
  }

  @Get(':id/fitbit/sleep')
  async getUserSleep(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: FitbitDateQueryDto,
  ) {
    return this.usersService.getUserSleepData(id, query.date);
  }

  @Get(':id/fitbit/week')
  async getUserWeek(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: FitbitWeekQueryDto,
  ) {
    return this.usersService.getUserWeekData(id, query.weekStart);
  }

  @Get(':id/fitbit/time-series')
  async getUserTimeSeries(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: FitbitTimeSeriesQueryDto,
  ) {
    return this.usersService.getUserTimeSeries(
      id,
      query.resource,
      query.startDate,
      query.endDate,
    );
  }

  @Get(':id/fitbit/intraday')
  async getUserIntraday(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: FitbitIntradayQueryDto,
  ) {
    return this.usersService.getUserIntraday(
      id,
      query.resource,
      query.startDate,
      query.endDate,
      query.detailLevel || FitbitDetailLevel.ONE_MIN,
      query.startTime,
      query.endTime,
    );
  }

  @Get(':id/fitbit/heart-rate')
  async getUserHeartRate(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: FitbitHeartRateQueryDto,
  ) {
    return this.usersService.getUserHeartRateIntraday(
      id,
      query.date,
      query.detailLevel || HeartRateDetailLevel.ONE_MIN,
      query.startTime,
      query.endTime,
    );
  }

  @Get(':id/fitbit/profile')
  async getUserProfile(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.getUserProfile(id);
  }

  @Get(':id/fitbit/devices')
  async getUserDevices(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.getUserDevices(id);
  }

  @Get(':id/fitbit/sync-history')
  async getSyncHistory(
    @Param('id', ParseIntPipe) id: number,
    @Query('limit') limit?: string,
  ) {
    return this.usersService.getSyncHistory(id, limit ? parseInt(limit) : 20);
  }

  @Get(':id/fitbit/all')
  async getUserAllData(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: FitbitDateQueryDto,
  ) {
    return this.usersService.getUserAllFitbitData(id, query.date);
  }

  @Post(':id/fitbit')
  async linkFitbit(
    @Param('id', ParseIntPipe) id: number,
    @Body() linkFitbitDto: LinkFitbitDto,
  ) {
    const user = await this.usersService.updateFitbitTokens(id, {
      fitbitUserId: linkFitbitDto.fitbitUserId,
      fitbitAccessToken: linkFitbitDto.accessToken,
      fitbitRefreshToken: linkFitbitDto.refreshToken,
      fitbitTokenExpiresAt: new Date(linkFitbitDto.expiresAt),
    });
    return this.sanitizeUser(user);
  }

  @Delete(':id/fitbit')
  @HttpCode(HttpStatus.OK)
  async disconnectFitbit(@Param('id', ParseIntPipe) id: number) {
    const user = await this.usersService.disconnectFitbit(id);
    return this.sanitizeUser(user);
  }

  // ================================
  // HELPERS
  // ================================

  private sanitizeUser(user: User): SanitizedUser {
    const {
      password: _password,
      fitbitAccessToken,
      fitbitRefreshToken: _fitbitRefreshToken,
      fitbitTokenExpiresAt: _fitbitTokenExpiresAt,
      ...sanitized
    } = user;

    return {
      ...sanitized,
      hasFitbitConnected: !!fitbitAccessToken,
      doctor: user.doctor ? this.sanitizeUser(user.doctor) : undefined,
      patients: user.patients?.map((p: User) => this.sanitizeUser(p)),
    };
  }
}
