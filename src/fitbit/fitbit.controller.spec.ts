import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { FitbitController } from './fitbit.controller';
import { FitbitService } from './fitbit.service';
import { SessionService } from './session.service';
import { UsersService } from '../users/users.service';

describe('FitbitController', () => {
  let controller: FitbitController;

  const mockFitbitService = {
    getAuthorizationUrl: jest.fn(),
    exchangeCodeForTokens: jest.fn(),
    refreshAccessToken: jest.fn(),
    getUserActivityData: jest.fn(),
    getUserSleepData: jest.fn(),
    getHeartRateIntraday: jest.fn(),
    getWeekDataByDay: jest.fn(),
    getActivityIntradayByDateRange: jest.fn(),
    getActivityTimeSeriesByDateRange: jest.fn(),
    createSubscription: jest.fn(),
    deleteSubscription: jest.fn(),
    pollPatientRealtimeData: jest.fn(),
  };

  const mockSessionService = {
    addPatientToSession: jest.fn(),
    getSessionPatients: jest.fn(),
    removePatientFromSession: jest.fn(),
    endSession: jest.fn(),
  };

  const mockEventEmitter = {
    emit: jest.fn(),
  };

  const mockUsersService = {
    updateFitbitTokens: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FitbitController],
      providers: [
        { provide: FitbitService, useValue: mockFitbitService },
        { provide: SessionService, useValue: mockSessionService },
        { provide: EventEmitter2, useValue: mockEventEmitter },
        { provide: UsersService, useValue: mockUsersService },
      ],
    }).compile();

    controller = module.get<FitbitController>(FitbitController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getActivity', () => {
    it('should throw UnauthorizedException when authorization header missing', async () => {
      await expect(
        controller.getActivity(undefined as unknown as string),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for invalid authorization format', async () => {
      await expect(controller.getActivity('invalid-format')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should return activity data when valid Bearer token provided', async () => {
      const mockActivity = { activities: [], summary: {} };
      mockFitbitService.getUserActivityData.mockResolvedValue(mockActivity);

      const result = await controller.getActivity(
        'Bearer valid-token',
        '2024-01-15',
      );

      expect(result).toEqual(mockActivity);
      expect(mockFitbitService.getUserActivityData).toHaveBeenCalledWith(
        'valid-token',
        '2024-01-15',
      );
    });
  });

  describe('getSleep', () => {
    it('should throw UnauthorizedException when authorization header missing', async () => {
      await expect(
        controller.getSleep(undefined as unknown as string),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should return sleep data when valid Bearer token provided', async () => {
      const mockSleep = { sleep: [], summary: {} };
      mockFitbitService.getUserSleepData.mockResolvedValue(mockSleep);

      const result = await controller.getSleep(
        'Bearer valid-token',
        '2024-01-15',
      );

      expect(result).toEqual(mockSleep);
      expect(mockFitbitService.getUserSleepData).toHaveBeenCalledWith(
        'valid-token',
        '2024-01-15',
      );
    });
  });

  describe('refreshToken', () => {
    it('should throw BadRequestException when refreshToken missing', async () => {
      const { BadRequestException } = await import('@nestjs/common');
      await expect(controller.refreshToken('')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should return new tokens', async () => {
      mockFitbitService.refreshAccessToken.mockResolvedValue({
        access_token: 'new-token',
        refresh_token: 'new-refresh',
        expires_in: 28800,
      });

      const result = await controller.refreshToken('old-refresh');

      expect(result.message).toBe('Token refreshed successfully');
      expect(result.accessToken).toBe('new-token');
    });
  });

  describe('getWeekData', () => {
    it('should throw UnauthorizedException when authorization missing', async () => {
      await expect(
        controller.getWeekData(undefined as unknown as string, '2024-01-08'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should return week data with valid Bearer token', async () => {
      const mockWeek = [{ date: '2024-01-08', activity: {}, sleep: {} }];
      mockFitbitService.getWeekDataByDay.mockResolvedValue(mockWeek);

      const result = await controller.getWeekData(
        'Bearer valid-token',
        '2024-01-08',
      );

      expect(result).toEqual(mockWeek);
      expect(mockFitbitService.getWeekDataByDay).toHaveBeenCalledWith(
        'valid-token',
        '2024-01-08',
      );
    });
  });

  describe('handleWebhook', () => {
    it('should emit events for each notification', () => {
      const notifications = [
        {
          collectionType: 'activities',
          ownerId: '123',
          ownerType: 'user',
          subscriptionId: 'sub-1',
        },
        {
          collectionType: 'sleep',
          ownerId: '456',
          ownerType: 'user',
          subscriptionId: 'sub-2',
        },
      ];

      controller.handleWebhook(notifications);

      expect(mockEventEmitter.emit).toHaveBeenCalledTimes(2);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'patient.data.updated',
        { patientId: '123', type: 'activities' },
      );
    });
  });
});
