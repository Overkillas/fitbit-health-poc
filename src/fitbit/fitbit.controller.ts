import { Controller, Get, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { FitbitService } from './fitbit.service';

@Controller('fitbit')
export class FitbitController {
  constructor(private readonly fitbitService: FitbitService) {}

  // Inicia o fluxo OAuth2
  @Get('auth')
  async initiateAuth(@Res() res: Response) {
    const authUrl = this.fitbitService.getAuthorizationUrl();
    res.redirect(authUrl);
  }

  // Callback após autorização
  @Get('callback')
  async handleCallback(@Query('code') code: string, @Res() res: Response) {
    if (!code) {
      return res.status(400).json({ error: 'Código de autorização não fornecido' });
    }

    try {
      const tokens = await this.fitbitService.exchangeCodeForTokens(code);
      
      // Retorna os tokens (depois você salvará no banco)
      res.json({
        message: 'Autenticação bem-sucedida!',
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        userId: tokens.user_id,
        expiresIn: tokens.expires_in,
      });
    } catch (error) {
      res.status(500).json({ 
        error: 'Erro na autenticação',
        details: error.message 
      });
    }
  }

  // Busca dados de atividade
  @Get('activity')
  async getActivity(
    @Query('accessToken') accessToken: string,
    @Query('date') date?: string,
  ) {
    if (!accessToken) {
      return { error: 'Access token é obrigatório' };
    }

    try {
      const data = await this.fitbitService.getUserActivityData(accessToken, date);
      return data;
    } catch (error) {
      return { 
        error: 'Erro ao buscar dados de atividade',
        details: error.message 
      };
    }
  }

  // Busca dados de sono
  @Get('sleep')
  async getSleep(
    @Query('accessToken') accessToken: string,
    @Query('date') date?: string,
  ) {
    if (!accessToken) {
      return { error: 'Access token é obrigatório' };
    }

    try {
      const data = await this.fitbitService.getUserSleepData(accessToken, date);
      return data;
    } catch (error) {
      return { 
        error: 'Erro ao buscar dados de sono',
        details: error.message 
      };
    }
  }

  // Renova o access token
  @Get('refresh')
  async refreshToken(@Query('refreshToken') refreshToken: string) {
    if (!refreshToken) {
      return { error: 'Refresh token é obrigatório' };
    }

    try {
      const newTokens = await this.fitbitService.refreshAccessToken(refreshToken);
      return {
        message: 'Token renovado com sucesso',
        accessToken: newTokens.access_token,
        refreshToken: newTokens.refresh_token,
        expiresIn: newTokens.expires_in,
      };
    } catch (error) {
      return { 
        error: 'Erro ao renovar token',
        details: error.message 
      };
    }
  }

  // Busca intraday (máximo 24h)
  @Get('intraday')
  async getIntraday(
    @Query('accessToken') accessToken: string,
    @Query('resource') resource: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('detailLevel') detailLevel: '1min' | '15min' = '1min',
    @Query('startTime') startTime?: string,
    @Query('endTime') endTime?: string,
  ) {
    if (!accessToken || !resource || !startDate || !endDate) {
      return { error: 'Parâmetros obrigatórios: accessToken, resource, startDate, endDate' };
    }

    try {
      const data = await this.fitbitService.getActivityIntradayByDateRange(
        accessToken,
        resource,
        startDate,
        endDate,
        detailLevel,
        startTime,
        endTime,
      );
      return data;
    } catch (error) {
      return { 
        error: 'Erro ao buscar intraday',
        details: error.message 
      };
    }
  }

  // Busca time series por intervalo
  @Get('time-series')
  async getTimeSeries(
    @Query('accessToken') accessToken: string,
    @Query('resource') resource: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    if (!accessToken || !resource || !startDate || !endDate) {
      return { error: 'Todos os parâmetros são obrigatórios: accessToken, resource, startDate, endDate' };
    }

    try {
      const data = await this.fitbitService.getActivityTimeSeriesByDateRange(
        accessToken,
        resource,
        startDate,
        endDate,
      );
      return data;
    } catch (error) {
      return { 
        error: 'Erro ao buscar time series',
        details: error.message 
      };
    }
  }

}
