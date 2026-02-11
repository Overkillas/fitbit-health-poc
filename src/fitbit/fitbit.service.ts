import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

// fitbit.service.ts

export interface WeekDayData {
  date: string;
  activity: any;
  sleep: any;
}

export interface WeekDayError {
  date: string;
  error: boolean;
  details: any;
}


@Injectable()
export class FitbitService {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri = 'http://localhost:3003/fitbit/callback';
  private readonly scope = 'activity heartrate sleep profile settings weight';

  constructor(private configService: ConfigService) {
    this.clientId = this.configService.get<string>('FITBIT_CLIENT_ID')!;
    this.clientSecret = this.configService.get<string>('FITBIT_CLIENT_SECRET')!;
  }

  // Gera URL de autorização
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

  // Troca authorization code por access token
  async exchangeCodeForTokens(code: string) {
    const tokenUrl = 'https://api.fitbit.com/oauth2/token';
    
    const credentials = Buffer.from(
      `${this.clientId}:${this.clientSecret}`
    ).toString('base64');
    
    const params = new URLSearchParams({
      client_id: this.clientId,
      grant_type: 'authorization_code',
      redirect_uri: this.redirectUri,
      code: code,
    });

    try {
      const response = await axios.post(tokenUrl, params.toString(), {
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      return response.data;
    } catch (error) {
      console.error('Erro ao trocar código por tokens:', error.response?.data);
      throw error;
    }
  }

  // Busca dados de atividade do usuário
  async getUserActivityData(accessToken: string, date?: string) {
    const targetDate = date || new Date().toISOString().split('T')[0];
    const url = `https://api.fitbit.com/1/user/-/activities/date/${targetDate}.json`;

    try {
      const response = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      return response.data;
    } catch (error) {
      console.error('Erro ao buscar dados:', error.response?.data);
      throw error;
    }
  }

  // Busca dados de sono
  async getUserSleepData(accessToken: string, date?: string) {
    const targetDate = date || new Date().toISOString().split('T')[0];
    const url = `https://api.fitbit.com/1.2/user/-/sleep/date/${targetDate}.json`;

    try {
      const response = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      return response.data;
    } catch (error) {
      console.error('Erro ao buscar dados de sono:', error.response?.data);
      throw error;
    }
  }

  // Refresh token quando expirar
  async refreshAccessToken(refreshToken: string) {
    const tokenUrl = 'https://api.fitbit.com/oauth2/token';
    const credentials = Buffer.from(
      `${this.clientId}:${this.clientSecret}`
    ).toString('base64');
    
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });

    try {
      const response = await axios.post(tokenUrl, params.toString(), {
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      return response.data;
    } catch (error) {
      console.error('Erro ao renovar token:', error.response?.data);
      throw error;
    }
  }

  // ----------------------------------
  // ------------ INTRADAY ------------
  // ----------------------------------

  // Busca dados intraday (minuto a minuto) - máximo 24h
  async getActivityIntradayByDateRange(
    accessToken: string,
    resource: string,
    startDate: string,
    endDate: string,
    detailLevel: '1min' | '15min' = '1min',
    startTime?: string,
    endTime?: string,
  ) {
    let url = `https://api.fitbit.com/1/user/-/activities/${resource}/date/${startDate}/${endDate}/${detailLevel}.json`;
    
    // Se especificar hora específica
    if (startTime && endTime) {
      url = `https://api.fitbit.com/1/user/-/activities/${resource}/date/${startDate}/${endDate}/${detailLevel}/time/${startTime}/${endTime}.json`;
    }

    try {
      const response = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      return response.data;
    } catch (error) {
      console.error('Erro ao buscar intraday:', error.response?.data);
      throw error;
    }
  }

  // ----------------------------------
  // ----------- Time Series ----------
  // ----------------------------------

  // Busca dados de atividade por intervalo de datas (resumo diário)
  async getActivityTimeSeriesByDateRange(
    accessToken: string,
    resource: string,
    startDate: string,
    endDate: string,
  ) {
    const url = `https://api.fitbit.com/1/user/-/activities/${resource}/date/${startDate}/${endDate}.json`;

    try {
      const response = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      return response.data;
    } catch (error) {
      console.error('Erro ao buscar time series:', error.response?.data);
      throw error;
    }
  }

  // ----------------------------------
  // --------- SUBSCRIPTIONS ----------
  // ----------------------------------

  // Cria uma subscription para um paciente
  async createSubscription(accessToken: string, patientId: string) {
    const url = `https://api.fitbit.com/1/user/-/activities/apiSubscriptions/${patientId}.json`;
    
    const credentials = Buffer.from(
      `${this.clientId}:${this.clientSecret}`
    ).toString('base64');

    try {
      const response = await axios.post(url, null, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'X-Fitbit-Subscriber-Id': this.clientId,
        },
      });
      return response.data;
    } catch (error) {
      console.error('Erro ao criar subscription:', error.response?.data);
      throw error;
    }
  }

  // Remove subscription de um paciente
  async deleteSubscription(accessToken: string, patientId: string) {
    const url = `https://api.fitbit.com/1/user/-/activities/apiSubscriptions/${patientId}.json`;
    
    try {
      const response = await axios.delete(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'X-Fitbit-Subscriber-Id': this.clientId,
        },
      });
      return response.data;
    } catch (error) {
      console.error('Erro ao deletar subscription:', error.response?.data);
      throw error;
    }
  }

  // ----------------------------------
  // --------- POLLING OTIMIZADO ------
  // ----------------------------------

  // Busca dados recentes de um paciente (último minuto disponível)
  async pollPatientRealtimeData(accessToken: string, patientId: string) {
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    const startTime = '00:00';
    const endTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    try {
      // Busca dados intraday de frequência cardíaca
      const heartRateUrl = `https://api.fitbit.com/1/user/-/activities/heart/date/${today}/1d/1min/time/${startTime}/${endTime}.json`;
      
      // Busca dados de passos
      const stepsUrl = `https://api.fitbit.com/1/user/-/activities/steps/date/${today}/1d/1min/time/${startTime}/${endTime}.json`;
      
      const [heartRateRes, stepsRes] = await Promise.all([
        axios.get(heartRateUrl, { 
          headers: { 'Authorization': `Bearer ${accessToken}` } 
        }).catch(err => {
          console.error('Erro ao buscar heart rate:', err.response?.data);
          return null;
        }),
        axios.get(stepsUrl, { 
          headers: { 'Authorization': `Bearer ${accessToken}` } 
        }).catch(err => {
          console.error('Erro ao buscar steps:', err.response?.data);
          return null;
        }),
      ]);
      
      const heartRateData = heartRateRes?.data['activities-heart-intraday']?.dataset || [];
      const stepsData = stepsRes?.data['activities-steps-intraday']?.dataset || [];
      
      // Retorna apenas os últimos 5 minutos de dados
      const last5Minutes = heartRateData.slice(-5);
      const last5MinutesSteps = stepsData.slice(-5);
      
      return {
        patientId,
        timestamp: new Date().toISOString(),
        heartRate: last5Minutes,
        steps: last5MinutesSteps,
      };
    } catch (error) {
      console.error('Erro no polling do paciente:', patientId, error.message);
      throw error;
    }
  }

  // Busca dados de frequência cardíaca intraday
  async getHeartRateIntraday(
    accessToken: string,
    date: string,
    detailLevel: '1sec' | '1min' = '1min',
    startTime?: string,
    endTime?: string,
  ) {
    let url = `https://api.fitbit.com/1/user/-/activities/heart/date/${date}/1d/${detailLevel}.json`;
    
    // Se especificar hora específica
    if (startTime && endTime) {
      url = `https://api.fitbit.com/1/user/-/activities/heart/date/${date}/1d/${detailLevel}/time/${startTime}/${endTime}.json`;
    }

    try {
      const response = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      return response.data;
    } catch (error) {
      console.error('Erro ao buscar heart rate intraday:', error.response?.data);
      throw error;
    }
  }

  async getWeekDataByDay(
    accessToken: string,
    weekStart: string, // formato yyyy-MM-dd
  ) {
    const result: Array<WeekDayData | WeekDayError> = []; // <- tipo explícito

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

        result.push({
          date: dateStr,
          activity,
          sleep,
        });
      } catch (error) {
        result.push({
          date: dateStr,
          error: true,
          details: (error as any).message,
        });
      }
    }

    return result;
  }

  // Busca perfil do usuário no Fitbit
  async getUserProfile(accessToken: string) {
    const url = 'https://api.fitbit.com/1/user/-/profile.json';

    try {
      const response = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      return response.data;
    } catch (error) {
      console.error('Erro ao buscar perfil:', error.response?.data);
      throw error;
    }
  }

  // Busca dispositivos do usuário (inclui lastSyncTime)
  async getUserDevices(accessToken: string) {
    const url = 'https://api.fitbit.com/1/user/-/devices.json';

    try {
      const response = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      return response.data;
    } catch (error) {
      console.error('Erro ao buscar dispositivos:', error.response?.data);
      throw error;
    }
  }

}
