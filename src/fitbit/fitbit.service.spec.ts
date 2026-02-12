import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { FitbitService } from './fitbit.service';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('FitbitService', () => {
  let service: FitbitService;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, string> = {
        FITBIT_CLIENT_ID: 'test-client-id',
        FITBIT_CLIENT_SECRET: 'test-client-secret',
      };
      return config[key];
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FitbitService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<FitbitService>(FitbitService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getAuthorizationUrl', () => {
    it('should generate a valid Fitbit OAuth URL', () => {
      const url = service.getAuthorizationUrl();
      expect(url).toContain('https://www.fitbit.com/oauth2/authorize');
      expect(url).toContain('client_id=test-client-id');
      expect(url).toContain('response_type=code');
      expect(url).toContain('scope=');
    });

    it('should include state parameter when provided', () => {
      const url = service.getAuthorizationUrl('user-123');
      expect(url).toContain('state=user-123');
    });

    it('should not include state parameter when not provided', () => {
      const url = service.getAuthorizationUrl();
      expect(url).not.toContain('state=');
    });
  });

  describe('exchangeCodeForTokens', () => {
    it('should exchange authorization code for tokens', async () => {
      const mockTokens = {
        access_token: 'access-123',
        refresh_token: 'refresh-123',
        user_id: 'user-abc',
        expires_in: 28800,
        token_type: 'Bearer',
        scope: 'activity heartrate sleep',
      };

      mockedAxios.post.mockResolvedValueOnce({ data: mockTokens });

      const result = await service.exchangeCodeForTokens('auth-code-123');

      expect(result).toEqual(mockTokens);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://api.fitbit.com/oauth2/token',
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/x-www-form-urlencoded',
          }),
        }),
      );
    });

    it('should throw on invalid code', async () => {
      mockedAxios.post.mockRejectedValueOnce(new Error('invalid_grant'));

      await expect(service.exchangeCodeForTokens('bad-code')).rejects.toThrow(
        'invalid_grant',
      );
    });
  });

  describe('refreshAccessToken', () => {
    it('should refresh access token successfully', async () => {
      const mockTokens = {
        access_token: 'new-access',
        refresh_token: 'new-refresh',
        user_id: 'user-abc',
        expires_in: 28800,
        token_type: 'Bearer',
        scope: 'activity heartrate sleep',
      };

      mockedAxios.post.mockResolvedValueOnce({ data: mockTokens });

      const result = await service.refreshAccessToken('old-refresh-token');

      expect(result.access_token).toBe('new-access');
      expect(result.refresh_token).toBe('new-refresh');
    });
  });

  describe('getUserActivityData', () => {
    it('should fetch activity data for today when no date provided', async () => {
      const mockActivity = {
        activities: [],
        goals: {
          activeMinutes: 30,
          caloriesOut: 2000,
          distance: 5,
          floors: 10,
          steps: 10000,
        },
        summary: {
          activeScore: -1,
          activityCalories: 500,
          caloriesBMR: 1500,
          caloriesOut: 2000,
          distances: [],
          fairlyActiveMinutes: 15,
          lightlyActiveMinutes: 200,
          marginalCalories: 300,
          sedentaryMinutes: 800,
          steps: 8000,
          veryActiveMinutes: 10,
        },
      };

      mockedAxios.get.mockResolvedValueOnce({ data: mockActivity });

      const result = await service.getUserActivityData('token-123');

      expect(result).toEqual(mockActivity);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('/activities/date/'),
        expect.objectContaining({
          headers: { Authorization: 'Bearer token-123' },
        }),
      );
    });

    it('should fetch activity data for a specific date', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: { activities: [], goals: {}, summary: {} },
      });

      await service.getUserActivityData('token-123', '2024-01-15');

      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('/activities/date/2024-01-15'),
        expect.anything(),
      );
    });
  });

  describe('getUserSleepData', () => {
    it('should fetch sleep data', async () => {
      const mockSleep = {
        sleep: [
          {
            dateOfSleep: '2024-01-15',
            duration: 28800000,
            efficiency: 90,
            isMainSleep: true,
            logId: 123,
            minutesAfterWakeup: 5,
            minutesAsleep: 420,
            minutesAwake: 30,
            minutesToFallAsleep: 10,
            startTime: '2024-01-14T23:00:00.000',
            timeInBed: 460,
            type: 'stages',
          },
        ],
        summary: {
          totalMinutesAsleep: 420,
          totalSleepRecords: 1,
          totalTimeInBed: 460,
        },
      };

      mockedAxios.get.mockResolvedValueOnce({ data: mockSleep });

      const result = await service.getUserSleepData('token-123', '2024-01-15');

      expect(result.sleep).toHaveLength(1);
      expect(result.summary.totalMinutesAsleep).toBe(420);
    });
  });

  describe('getUserProfile', () => {
    it('should fetch user profile', async () => {
      const mockProfile = {
        user: {
          age: 30,
          avatar: 'https://example.com/avatar.png',
          averageDailySteps: 8000,
          country: 'BR',
          dateOfBirth: '1994-01-01',
          displayName: 'Test User',
          encodedId: 'ABC123',
          fullName: 'Test User',
          gender: 'MALE',
          height: 175,
          weight: 75,
          strideLengthWalking: 70,
          strideLengthRunning: 90,
          timezone: 'America/Sao_Paulo',
        },
      };

      mockedAxios.get.mockResolvedValueOnce({ data: mockProfile });

      const result = await service.getUserProfile('token-123');

      expect(result.user.displayName).toBe('Test User');
      expect(result.user.encodedId).toBe('ABC123');
    });
  });

  describe('getUserDevices', () => {
    it('should fetch user devices', async () => {
      const mockDevices = [
        {
          battery: 'High',
          batteryLevel: 85,
          deviceVersion: 'Inspire HR',
          features: [],
          id: 'device-1',
          lastSyncTime: '2024-01-15T10:00:00.000',
          mac: 'AA:BB:CC:DD:EE:FF',
          type: 'TRACKER',
        },
      ];

      mockedAxios.get.mockResolvedValueOnce({ data: mockDevices });

      const result = await service.getUserDevices('token-123');

      expect(result).toHaveLength(1);
      expect(result[0].deviceVersion).toBe('Inspire HR');
      expect(result[0].battery).toBe('High');
    });
  });

  describe('getWeekDataByDay', () => {
    it('should fetch 7 days of data', async () => {
      // Each day makes 2 requests (activity + sleep)
      for (let i = 0; i < 7; i++) {
        mockedAxios.get
          .mockResolvedValueOnce({
            data: { activities: [], goals: {}, summary: {} },
          })
          .mockResolvedValueOnce({
            data: { sleep: [], summary: {} },
          });
      }

      const result = await service.getWeekDataByDay('token-123', '2024-01-08');

      expect(result).toHaveLength(7);
      // 7 days * 2 requests each
      expect(mockedAxios.get).toHaveBeenCalledTimes(14);
    });
  });

  describe('getHeartRateIntraday', () => {
    it('should fetch heart rate intraday data', async () => {
      const mockHR = {
        'activities-heart': [
          {
            dateTime: '2024-01-15',
            value: {
              customHeartRateZones: [],
              heartRateZones: [],
              restingHeartRate: 65,
            },
          },
        ],
        'activities-heart-intraday': {
          dataset: [
            { time: '10:00:00', value: 72 },
            { time: '10:01:00', value: 75 },
          ],
          datasetInterval: 1,
          datasetType: 'minute',
        },
      };

      mockedAxios.get.mockResolvedValueOnce({ data: mockHR });

      const result = await service.getHeartRateIntraday(
        'token-123',
        '2024-01-15',
        '1min',
      );

      expect(result['activities-heart']).toHaveLength(1);
      expect(result['activities-heart-intraday']?.dataset).toHaveLength(2);
    });
  });
});
