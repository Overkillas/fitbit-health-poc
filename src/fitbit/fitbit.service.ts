import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import {
  FitbitTokenResponse,
  FitbitActivityResponse,
  FitbitSleepResponse,
  FitbitHeartRateResponse,
  FitbitDeviceInfo,
  FitbitProfileResponse,
  FitbitTimeSeriesResponse,
  FitbitIntradayResponse,
  WeekDayData,
  WeekDayError,
  PatientPollingData,
} from './fitbit.types';

@Injectable()
export class FitbitService {
  private readonly logger = new Logger(FitbitService.name);
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;
  private readonly scope = 'activity heartrate sleep profile settings weight';

  constructor(private configService: ConfigService) {
    this.clientId = this.configService.get<string>('FITBIT_CLIENT_ID')!;
    this.clientSecret = this.configService.get<string>('FITBIT_CLIENT_SECRET')!;
    this.redirectUri = this.configService.get<string>('FITBIT_REDIRECT_URI')
      || `http://localhost:${this.configService.get<number>('PORT', 3003)}/fitbit/callback`;
  }

  // ---- HTTP helpers ----

  private async fitbitGet<T>(url: string, accessToken: string, context: string): Promise<T> {
    try {
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      return response.data as T;
    } catch (error) {
      this.logger.error(`Failed to ${context}:`, (error as Error).message);
      throw error;
    }
  }

  private getBasicAuthHeaders() {
    const credentials = Buffer.from(
      `${this.clientId}:${this.clientSecret}`,
    ).toString('base64');
    return {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    };
  }

  // ---- OAuth ----

  getAuthorizationUrl(state?: string): string {
    const baseUrl = 'https://www.fitbit.com/oauth2/authorize';
    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      scope: this.scope,
      redirect_uri: this.redirectUri,
    });

    if (state) {
      params.append('state', state);
    }

    return `${baseUrl}?${params.toString()}`;
  }

  async exchangeCodeForTokens(code: string): Promise<FitbitTokenResponse> {
    const params = new URLSearchParams({
      client_id: this.clientId,
      grant_type: 'authorization_code',
      redirect_uri: this.redirectUri,
      code,
    });

    try {
      const response = await axios.post(
        'https://api.fitbit.com/oauth2/token',
        params.toString(),
        { headers: this.getBasicAuthHeaders() },
      );
      return response.data as FitbitTokenResponse;
    } catch (error) {
      this.logger.error('Failed to exchange code for tokens:', (error as Error).message);
      throw error;
    }
  }

  async refreshAccessToken(refreshToken: string): Promise<FitbitTokenResponse> {
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });

    try {
      const response = await axios.post(
        'https://api.fitbit.com/oauth2/token',
        params.toString(),
        { headers: this.getBasicAuthHeaders() },
      );
      return response.data as FitbitTokenResponse;
    } catch (error) {
      this.logger.error('Failed to refresh token:', (error as Error).message);
      throw error;
    }
  }

  // ---- Data endpoints ----

  async getUserActivityData(
    accessToken: string,
    date?: string,
  ): Promise<FitbitActivityResponse> {
    const targetDate = date || new Date().toISOString().split('T')[0];
    return this.fitbitGet(
      `https://api.fitbit.com/1/user/-/activities/date/${targetDate}.json`,
      accessToken,
      'fetch activity data',
    );
  }

  async getUserSleepData(
    accessToken: string,
    date?: string,
  ): Promise<FitbitSleepResponse> {
    const targetDate = date || new Date().toISOString().split('T')[0];
    return this.fitbitGet(
      `https://api.fitbit.com/1.2/user/-/sleep/date/${targetDate}.json`,
      accessToken,
      'fetch sleep data',
    );
  }

  async getUserProfile(accessToken: string): Promise<FitbitProfileResponse> {
    return this.fitbitGet(
      'https://api.fitbit.com/1/user/-/profile.json',
      accessToken,
      'fetch profile',
    );
  }

  async getUserDevices(accessToken: string): Promise<FitbitDeviceInfo[]> {
    return this.fitbitGet(
      'https://api.fitbit.com/1/user/-/devices.json',
      accessToken,
      'fetch devices',
    );
  }

  // ---- Intraday ----

  async getActivityIntradayByDateRange(
    accessToken: string,
    resource: string,
    startDate: string,
    endDate: string,
    detailLevel: '1min' | '15min' = '1min',
    startTime?: string,
    endTime?: string,
  ): Promise<FitbitIntradayResponse> {
    const base = `https://api.fitbit.com/1/user/-/activities/${resource}/date/${startDate}/${endDate}/${detailLevel}`;
    const url = startTime && endTime
      ? `${base}/time/${startTime}/${endTime}.json`
      : `${base}.json`;

    return this.fitbitGet(url, accessToken, 'fetch intraday data');
  }

  async getHeartRateIntraday(
    accessToken: string,
    date: string,
    detailLevel: '1sec' | '1min' = '1min',
    startTime?: string,
    endTime?: string,
  ): Promise<FitbitHeartRateResponse> {
    const base = `https://api.fitbit.com/1/user/-/activities/heart/date/${date}/1d/${detailLevel}`;
    const url = startTime && endTime
      ? `${base}/time/${startTime}/${endTime}.json`
      : `${base}.json`;

    return this.fitbitGet(url, accessToken, 'fetch heart rate intraday');
  }

  // ---- Time Series ----

  async getActivityTimeSeriesByDateRange(
    accessToken: string,
    resource: string,
    startDate: string,
    endDate: string,
  ): Promise<FitbitTimeSeriesResponse> {
    return this.fitbitGet(
      `https://api.fitbit.com/1/user/-/activities/${resource}/date/${startDate}/${endDate}.json`,
      accessToken,
      'fetch time series',
    );
  }

  async getWeekDataByDay(
    accessToken: string,
    weekStart: string,
  ): Promise<Array<WeekDayData | WeekDayError>> {
    const result: Array<WeekDayData | WeekDayError> = [];
    const start = new Date(weekStart);

    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(start);
      currentDate.setDate(start.getDate() + i);
      const dateStr = currentDate.toISOString().split('T')[0];

      try {
        const [activity, sleep] = await Promise.all([
          this.getUserActivityData(accessToken, dateStr),
          this.getUserSleepData(accessToken, dateStr),
        ]);
        result.push({ date: dateStr, activity, sleep });
      } catch (error) {
        result.push({
          date: dateStr,
          error: true,
          details: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return result;
  }

  // ---- Subscriptions ----

  async createSubscription(
    accessToken: string,
    patientId: string,
  ): Promise<unknown> {
    const url = `https://api.fitbit.com/1/user/-/activities/apiSubscriptions/${patientId}.json`;

    try {
      const response = await axios.post(url, null, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'X-Fitbit-Subscriber-Id': this.clientId,
        },
      });
      return response.data;
    } catch (error) {
      this.logger.error('Failed to create subscription:', (error as Error).message);
      throw error;
    }
  }

  async deleteSubscription(
    accessToken: string,
    patientId: string,
  ): Promise<unknown> {
    const url = `https://api.fitbit.com/1/user/-/activities/apiSubscriptions/${patientId}.json`;

    try {
      const response = await axios.delete(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'X-Fitbit-Subscriber-Id': this.clientId,
        },
      });
      return response.data;
    } catch (error) {
      this.logger.error('Failed to delete subscription:', (error as Error).message);
      throw error;
    }
  }

  // ---- Polling ----

  async pollPatientRealtimeData(
    accessToken: string,
    patientId: string,
  ): Promise<PatientPollingData> {
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    const startTime = '00:00';
    const endTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    try {
      const heartRateUrl = `https://api.fitbit.com/1/user/-/activities/heart/date/${today}/1d/1min/time/${startTime}/${endTime}.json`;
      const stepsUrl = `https://api.fitbit.com/1/user/-/activities/steps/date/${today}/1d/1min/time/${startTime}/${endTime}.json`;

      const [heartRateRes, stepsRes] = await Promise.all([
        axios
          .get(heartRateUrl, { headers: { Authorization: `Bearer ${accessToken}` } })
          .catch(() => null),
        axios
          .get(stepsUrl, { headers: { Authorization: `Bearer ${accessToken}` } })
          .catch(() => null),
      ]);

      const heartRateResponse = heartRateRes?.data as FitbitHeartRateResponse | undefined;
      const stepsResponse = stepsRes?.data as FitbitIntradayResponse | undefined;

      const heartRateDataset: Array<{ time: string; value: number }> =
        (heartRateResponse?.['activities-heart-intraday']?.dataset as Array<{
          time: string;
          value: number;
        }>) || [];
      const stepsDataset: Array<{ time: string; value: number }> =
        (
          (stepsResponse as Record<string, unknown>)?.[
            'activities-steps-intraday'
          ] as { dataset?: Array<{ time: string; value: number }> }
        )?.dataset || [];

      const last5Minutes = heartRateDataset.slice(-5);
      const last5MinutesSteps = stepsDataset.slice(-5);

      return {
        patientId,
        timestamp: new Date().toISOString(),
        heartRate: last5Minutes,
        steps: last5MinutesSteps,
      };
    } catch (error) {
      this.logger.error('Failed to poll patient data:', patientId, (error as Error).message);
      throw error;
    }
  }
}
