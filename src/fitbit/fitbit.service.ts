import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class FitbitService {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri = 'http://localhost:3003/fitbit/callback';
  private readonly scope = 'activity heartrate sleep profile';

  constructor(private configService: ConfigService) {
    this.clientId = this.configService.get<string>('FITBIT_CLIENT_ID')!;
    this.clientSecret = this.configService.get<string>('FITBIT_CLIENT_SECRET')!;
  }

  // Gera URL de autorização
  getAuthorizationUrl(): string {
    const baseUrl = 'https://www.fitbit.com/oauth2/authorize';
    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      scope: this.scope,
      redirect_uri: this.redirectUri,
    });
    
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

}
