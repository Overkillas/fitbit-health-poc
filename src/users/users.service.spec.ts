import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { User, UserRole } from './entities/user.entity';
import { SyncHistory } from './entities/sync-history.entity';
import { FitbitService } from '../fitbit/fitbit.service';

describe('UsersService', () => {
  let service: UsersService;

  const mockUsersRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockSyncHistoryRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockFitbitService = {
    getUserActivityData: jest.fn(),
    getUserSleepData: jest.fn(),
    getWeekDataByDay: jest.fn(),
    refreshAccessToken: jest.fn(),
    getHeartRateIntraday: jest.fn(),
    getUserProfile: jest.fn(),
    getUserDevices: jest.fn(),
    getActivityTimeSeriesByDateRange: jest.fn(),
    getActivityIntradayByDateRange: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: mockUsersRepository },
        {
          provide: getRepositoryToken(SyncHistory),
          useValue: mockSyncHistoryRepository,
        },
        { provide: FitbitService, useValue: mockFitbitService },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createUserDto = {
      name: 'Test User',
      email: 'test@example.com',
      phone: '11999999999',
      password: 'password123',
      role: UserRole.PATIENT,
    };

    it('should create a new user', async () => {
      mockUsersRepository.findOne.mockResolvedValue(null);
      const createdUser = { id: 1, ...createUserDto, password: 'hashed' };
      mockUsersRepository.create.mockReturnValue(createdUser);
      mockUsersRepository.save.mockResolvedValue(createdUser);

      const result = await service.create(createUserDto);

      expect(result).toEqual(createdUser);
      expect(mockUsersRepository.create).toHaveBeenCalled();
      expect(mockUsersRepository.save).toHaveBeenCalled();
    });

    it('should throw ConflictException for duplicate email', async () => {
      mockUsersRepository.findOne.mockResolvedValueOnce({
        id: 2,
        email: 'test@example.com',
      });

      await expect(service.create(createUserDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw ConflictException for duplicate phone', async () => {
      mockUsersRepository.findOne
        .mockResolvedValueOnce(null) // email check
        .mockResolvedValueOnce({ id: 2, phone: '11999999999' }); // phone check

      await expect(service.create(createUserDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should validate doctorId when creating a patient with doctor', async () => {
      const dtoWithDoctor = {
        ...createUserDto,
        role: UserRole.PATIENT,
        doctorId: 99,
      };

      mockUsersRepository.findOne
        .mockResolvedValueOnce(null) // email check
        .mockResolvedValueOnce(null) // phone check
        .mockResolvedValueOnce(null); // doctor check

      await expect(service.create(dtoWithDoctor)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findByIdOrFail', () => {
    it('should return user when found', async () => {
      const user = { id: 1, name: 'Test', role: UserRole.PATIENT };
      mockUsersRepository.findOne.mockResolvedValue(user);

      const result = await service.findByIdOrFail(1);

      expect(result).toEqual(user);
    });

    it('should throw NotFoundException when user not found', async () => {
      mockUsersRepository.findOne.mockResolvedValue(null);

      await expect(service.findByIdOrFail(999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findPatientsByDoctor', () => {
    it('should return patients for a doctor', async () => {
      const doctor = { id: 1, role: UserRole.DOCTOR };
      const patients = [
        { id: 2, name: 'Patient 1', role: UserRole.PATIENT },
        { id: 3, name: 'Patient 2', role: UserRole.PATIENT },
      ];

      mockUsersRepository.findOne.mockResolvedValue(doctor);
      mockUsersRepository.find.mockResolvedValue(patients);

      const result = await service.findPatientsByDoctor(1);

      expect(result).toHaveLength(2);
    });

    it('should throw BadRequestException when user is not a doctor', async () => {
      mockUsersRepository.findOne.mockResolvedValue({
        id: 1,
        role: UserRole.PATIENT,
      });

      await expect(service.findPatientsByDoctor(1)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('delete', () => {
    it('should delete a user', async () => {
      mockUsersRepository.findOne.mockResolvedValue({
        id: 1,
        role: UserRole.PATIENT,
        patients: [],
      });
      mockUsersRepository.delete.mockResolvedValue({ affected: 1 });

      await expect(service.delete(1)).resolves.not.toThrow();
    });

    it('should throw BadRequestException when deleting doctor with patients', async () => {
      mockUsersRepository.findOne.mockResolvedValue({
        id: 1,
        role: UserRole.DOCTOR,
        patients: [{ id: 2 }],
      });

      await expect(service.delete(1)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getUserActivityData', () => {
    const mockUser = {
      id: 1,
      name: 'Patient',
      fitbitAccessToken: 'valid-token',
      fitbitRefreshToken: 'refresh-token',
      fitbitTokenExpiresAt: new Date(Date.now() + 3600000), // 1 hour from now
    };

    it('should fetch activity data for a user with valid token', async () => {
      mockUsersRepository.findOne.mockResolvedValue(mockUser);
      const mockActivity = { activities: [], goals: {}, summary: {} };
      mockFitbitService.getUserActivityData.mockResolvedValue(mockActivity);

      const result = await service.getUserActivityData(1, '2024-01-15');

      expect(result).toEqual(mockActivity);
      expect(mockFitbitService.getUserActivityData).toHaveBeenCalledWith(
        'valid-token',
        '2024-01-15',
      );
    });

    it('should throw BadRequestException when user has no Fitbit connected', async () => {
      mockUsersRepository.findOne.mockResolvedValue({
        id: 1,
        fitbitAccessToken: null,
        fitbitRefreshToken: null,
      });

      await expect(service.getUserActivityData(1)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should refresh token when near expiration', async () => {
      const expiringUser = {
        ...mockUser,
        fitbitTokenExpiresAt: new Date(Date.now() + 60000), // 1 minute from now (within 5-min buffer)
      };

      mockUsersRepository.findOne.mockResolvedValue(expiringUser);
      mockFitbitService.refreshAccessToken.mockResolvedValue({
        access_token: 'new-token',
        refresh_token: 'new-refresh',
        user_id: 'user-abc',
        expires_in: 28800,
      });
      mockUsersRepository.update.mockResolvedValue({ affected: 1 });
      mockFitbitService.getUserActivityData.mockResolvedValue({
        activities: [],
      });

      await service.getUserActivityData(1);

      expect(mockFitbitService.refreshAccessToken).toHaveBeenCalledWith(
        'refresh-token',
      );
    });
  });

  describe('getUserAllFitbitData', () => {
    it('should fetch all fitbit data for a user', async () => {
      const mockUser = {
        id: 1,
        name: 'Patient',
        fitbitAccessToken: 'token',
        fitbitRefreshToken: 'refresh',
        fitbitTokenExpiresAt: new Date(Date.now() + 3600000),
      };

      mockUsersRepository.findOne.mockResolvedValue(mockUser);
      mockFitbitService.getUserActivityData.mockResolvedValue({
        activities: [],
      });
      mockFitbitService.getUserSleepData.mockResolvedValue({ sleep: [] });
      mockFitbitService.getHeartRateIntraday.mockResolvedValue({
        'activities-heart': [],
      });

      const result = await service.getUserAllFitbitData(1, '2024-01-15');

      expect(result.userId).toBe(1);
      expect(result.userName).toBe('Patient');
      expect(result.date).toBe('2024-01-15');
      expect(result.activity).toBeDefined();
      expect(result.sleep).toBeDefined();
      expect(result.heartRate).toBeDefined();
    });
  });

  describe('getSyncHistory', () => {
    it('should return sync history for a user', async () => {
      const mockHistory = [
        {
          id: 1,
          userId: 1,
          syncTime: new Date(),
          deviceName: 'Inspire HR',
        },
      ];

      mockUsersRepository.findOne.mockResolvedValue({ id: 1 });
      mockSyncHistoryRepository.find.mockResolvedValue(mockHistory);

      const result = await service.getSyncHistory(1, 10);

      expect(result).toHaveLength(1);
      expect(mockSyncHistoryRepository.find).toHaveBeenCalledWith({
        where: { userId: 1 },
        order: { syncTime: 'DESC' },
        take: 10,
      });
    });
  });
});
