import { Body, Controller, Delete, Get, Param, Post, Query, Res, Sse, Headers } from '@nestjs/common';
import { Response } from 'express';
import { FitbitService } from './fitbit.service';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { Subject, Observable, interval } from 'rxjs';
import { switchMap, map } from 'rxjs/operators'; // Importe separado
import { SessionService } from './session.service';

interface MessageEvent {
  data: string | object;
  id?: string;
  type?: string;
  retry?: number;
}

interface PatientData {
  patientId: string;
  timestamp: string;
  heartRate: any;
  steps: any;
  patientName?: string;
}


@Controller('fitbit')
export class FitbitController {
  // Map para gerenciar streams de cada sessão
  private sessionStreams: Map<string, Subject<MessageEvent>> = new Map();

  constructor(
    private readonly fitbitService: FitbitService,
    private readonly sessionService: SessionService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

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


  @Get('heart-rate-intraday')
async getHeartRateIntraday(
  @Query('accessToken') accessToken: string,
  @Query('date') date: string,
  @Query('detailLevel') detailLevel: '1sec' | '1min' = '1min',
  @Query('startTime') startTime?: string,
  @Query('endTime') endTime?: string,
) {
  if (!accessToken || !date) {
    return { error: 'Parâmetros obrigatórios: accessToken, date' };
  }

  try {
    const data = await this.fitbitService.getHeartRateIntraday(
      accessToken,
      date,
      detailLevel,
      startTime,
      endTime,
    );
    return data;
  } catch (error) {
    return { 
      error: 'Erro ao buscar heart rate intraday',
      details: error.message,
      fitbitError: error.response?.data 
    };
  }
}

  // ----------------------------------
  // --------- WEBHOOK ----------------
  // ----------------------------------

  @Post('webhook')
  async handleWebhook(
    @Body() body: any,
    @Headers() headers: Record<string, string>,
  ) {
    console.log('Webhook recebido do Fitbit:', body);
    
    // body é um array de notificações
    // Exemplo: [{ collectionType: 'activities', ownerId: '123ABC', ownerType: 'user', subscriptionId: 'patient-123' }]
    
    for (const notification of body) {
      // Emite evento interno para processar atualização
      this.eventEmitter.emit('patient.data.updated', {
        patientId: notification.ownerId,
        type: notification.collectionType,
      });
    }
    
    return; // Fitbit espera resposta 204 (No Content)
  }

  // Listener para quando webhook notificar atualização
  @OnEvent('patient.data.updated')
  async handlePatientDataUpdate(payload: { patientId: string; type: string }) {
    console.log('Dados do paciente atualizados:', payload);
    // Aqui você pode fazer polling imediato deste paciente específico
    // ou agendar uma atualização prioritária
  }

  // ----------------------------------
  // --------- SESSÕES ----------------
  // ----------------------------------

  // Adiciona um paciente a uma sessão de reabilitação
  @Post('session/:sessionId/patient')
  async addPatientToSession(
    @Param('sessionId') sessionId: string,
    @Body() body: { patientId: string; name: string; accessToken: string; refreshToken: string; userId: string },
  ) {
    this.sessionService.addPatientToSession(sessionId, {
      id: body.patientId,
      userId: body.userId,
      accessToken: body.accessToken,
      refreshToken: body.refreshToken,
      sessionId: sessionId,
      name: body.name,
    });

    try {
      await this.fitbitService.createSubscription(body.accessToken, body.patientId);
    } catch (error) {
      console.error('Erro ao criar subscription:', error);
    }

    return { message: 'Paciente adicionado à sessão', sessionId, patientId: body.patientId };
  }

  @Delete('session/:sessionId/patient/:patientId')
  async removePatientFromSession(
    @Param('sessionId') sessionId: string,
    @Param('patientId') patientId: string,
  ) {
    const patients = this.sessionService.getSessionPatients(sessionId);
    const patient = patients.find(p => p.id === patientId);
    
    if (patient) {
      try {
        await this.fitbitService.deleteSubscription(patient.accessToken, patientId);
      } catch (error) {
        console.error('Erro ao remover subscription:', error);
      }
    }

    this.sessionService.removePatientFromSession(sessionId, patientId);
    return { message: 'Paciente removido da sessão' };
  }

  // ----------------------------------
  // --------- SSE (TEMPO REAL) -------
  // ----------------------------------

  @Sse('session/:sessionId/live')
  livePatientData(@Param('sessionId') sessionId: string): Observable<MessageEvent> {
    console.log(`Médico conectado ao stream da sessão: ${sessionId}`);

    if (!this.sessionStreams.has(sessionId)) {
      this.sessionStreams.set(sessionId, new Subject<MessageEvent>());
    }

    const sessionSubject = this.sessionStreams.get(sessionId)!;

    // CORREÇÃO 2: Adicione tipagem explícita ao array
    const pollingInterval = interval(60000).pipe(
      switchMap(async () => {
        const patients = this.sessionService.getSessionPatients(sessionId);
        
        if (patients.length === 0) {
          return null;
        }

        // Declare o array com tipo explícito
        const allData: PatientData[] = []; // CORREÇÃO 2
        
        for (let i = 0; i < patients.length; i++) {
          const patient = patients[i];
          
          try {
            const data = await this.fitbitService.pollPatientRealtimeData(
              patient.accessToken,
              patient.id,
            );
            
            allData.push({
              ...data,
              patientName: patient.name,
            });
            
            if (i < patients.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
          } catch (error) {
            console.error(`Erro ao buscar dados do paciente ${patient.id}:`, error.message);
          }
        }

        return allData;
      }),
      map(data => ({
        data: JSON.stringify(data),
        type: 'patient-data',
      } as MessageEvent)),
    );

    pollingInterval.subscribe(event => {
      if (event.data !== 'null') {
        sessionSubject.next(event);
      }
    });

    return sessionSubject.asObservable();
  }

  @Delete('session/:sessionId')
  async endSession(@Param('sessionId') sessionId: string) {
    const patients = this.sessionService.getSessionPatients(sessionId);
    
    for (const patient of patients) {
      try {
        await this.fitbitService.deleteSubscription(patient.accessToken, patient.id);
      } catch (error) {
        console.error('Erro ao remover subscription:', error);
      }
    }

    const stream = this.sessionStreams.get(sessionId);
    if (stream) {
      stream.complete();
      this.sessionStreams.delete(sessionId);
    }

    this.sessionService.endSession(sessionId);
    return { message: 'Sessão encerrada' };
  }

  @Get('week')
  async getWeekData(
    @Query('accessToken') accessToken: string,
    @Query('weekStart') weekStart: string, // yyyy-MM-dd
  ) {
    if (!accessToken || !weekStart) {
      return { error: 'Parâmetros obrigatórios: accessToken, weekStart (yyyy-MM-dd)' };
    }

    try {
      const data = await this.fitbitService.getWeekDataByDay(accessToken, weekStart);
      return data;
    } catch (error) {
      return {
        error: 'Erro ao buscar dados da semana',
        details: error.message,
      };
    }
  }
}

