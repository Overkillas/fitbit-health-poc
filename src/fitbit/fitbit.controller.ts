import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  InternalServerErrorException,
  Logger,
  Param,
  Post,
  Query,
  Req,
  Res,
  Sse,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { FitbitService } from './fitbit.service';
import { FitbitWebhookNotification, PatientPollingData } from './fitbit.types';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { Subject, Observable, interval, Subscription } from 'rxjs';
import { switchMap, map } from 'rxjs/operators';
import { SessionService } from './session.service';
import { UsersService } from '../users/users.service';

interface MessageEvent {
  data: string | object;
  id?: string;
  type?: string;
  retry?: number;
}

type PatientData = PatientPollingData;

@Controller('fitbit')
export class FitbitController {
  private readonly logger = new Logger(FitbitController.name);
  private sessionStreams: Map<string, Subject<MessageEvent>> = new Map();
  private sessionPolling: Map<string, Subscription> = new Map();

  constructor(
    private readonly fitbitService: FitbitService,
    private readonly sessionService: SessionService,
    private readonly eventEmitter: EventEmitter2,
    private readonly usersService: UsersService,
  ) {}

  private extractBearerToken(authorization?: string): string {
    if (!authorization) {
      throw new UnauthorizedException(
        'Authorization header is required (Bearer <token>)',
      );
    }
    const [scheme, token] = authorization.split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException(
        'Invalid authorization format. Use: Bearer <token>',
      );
    }
    return token;
  }

  // Initiates the OAuth2 flow
  @Get('auth')
  initiateAuth(@Query('userId') userId: string, @Res() res: Response) {
    const authUrl = this.fitbitService.getAuthorizationUrl(userId);
    res.redirect(authUrl);
  }

  // OAuth2 callback after authorization
  @Get('callback')
  async handleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (!code) {
      return res
        .status(400)
        .json({ error: 'Authorization code not provided' });
    }

    const rawPrefix = req.headers['x-forwarded-prefix'] as string | undefined;
    const prefix = rawPrefix ? rawPrefix.replace(/\/$/, '') : '';

    try {
      const tokens = await this.fitbitService.exchangeCodeForTokens(code);

      // If state (userId) is present, save tokens to the database
      if (state) {
        const userId = parseInt(state, 10);
        if (!isNaN(userId)) {
          const expiresAt = new Date();
          expiresAt.setSeconds(expiresAt.getSeconds() + tokens.expires_in);

          await this.usersService.updateFitbitTokens(userId, {
            fitbitUserId: tokens.user_id,
            fitbitAccessToken: tokens.access_token,
            fitbitRefreshToken: tokens.refresh_token,
            fitbitTokenExpiresAt: expiresAt,
          });

          // Redirect to success page
          return res.redirect(`${prefix}/fitbit/connect?success=true&userId=${userId}`);
        }
      }

      // No userId in state — return JSON response
      res.json({
        message: 'Authentication successful',
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        userId: tokens.user_id,
        expiresIn: tokens.expires_in,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (state) {
        return res.redirect(
          `${prefix}/fitbit/connect?success=false&error=${encodeURIComponent(message)}`,
        );
      }
      res.status(500).json({
        error: 'Authentication failed',
        details: message,
      });
    }
  }

  // Serves the Fitbit connection page
  @Get('connect')
  connectPage(@Res() res: Response) {
    res.sendFile('fitbit-connect.html', { root: 'public' });
  }

  // Fetches activity data
  @Get('activity')
  async getActivity(
    @Headers('authorization') authorization: string,
    @Query('date') date?: string,
  ) {
    const accessToken = this.extractBearerToken(authorization);

    try {
      return await this.fitbitService.getUserActivityData(accessToken, date);
    } catch (error) {
      throw new InternalServerErrorException(
        'Failed to fetch activity data',
        { cause: error },
      );
    }
  }

  // Fetches sleep data
  @Get('sleep')
  async getSleep(
    @Headers('authorization') authorization: string,
    @Query('date') date?: string,
  ) {
    const accessToken = this.extractBearerToken(authorization);

    try {
      return await this.fitbitService.getUserSleepData(accessToken, date);
    } catch (error) {
      throw new InternalServerErrorException('Failed to fetch sleep data', {
        cause: error,
      });
    }
  }

  // Refreshes the access token
  @Post('refresh')
  async refreshToken(@Body('refreshToken') refreshToken: string) {
    if (!refreshToken) {
      throw new BadRequestException('refreshToken is required in request body');
    }

    try {
      const newTokens =
        await this.fitbitService.refreshAccessToken(refreshToken);
      return {
        message: 'Token refreshed successfully',
        accessToken: newTokens.access_token,
        refreshToken: newTokens.refresh_token,
        expiresIn: newTokens.expires_in,
      };
    } catch (error) {
      throw new InternalServerErrorException('Failed to refresh token', {
        cause: error,
      });
    }
  }

  // Fetches intraday data (max 24h)
  @Get('intraday')
  async getIntraday(
    @Headers('authorization') authorization: string,
    @Query('resource') resource: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('detailLevel') detailLevel: '1min' | '15min' = '1min',
    @Query('startTime') startTime?: string,
    @Query('endTime') endTime?: string,
  ) {
    const accessToken = this.extractBearerToken(authorization);

    if (!resource || !startDate || !endDate) {
      throw new BadRequestException(
        'Required parameters: resource, startDate, endDate',
      );
    }

    try {
      return await this.fitbitService.getActivityIntradayByDateRange(
        accessToken,
        resource,
        startDate,
        endDate,
        detailLevel,
        startTime,
        endTime,
      );
    } catch (error) {
      throw new InternalServerErrorException('Failed to fetch intraday data', {
        cause: error,
      });
    }
  }

  // Fetches time series by date range
  @Get('time-series')
  async getTimeSeries(
    @Headers('authorization') authorization: string,
    @Query('resource') resource: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    const accessToken = this.extractBearerToken(authorization);

    if (!resource || !startDate || !endDate) {
      throw new BadRequestException(
        'Required parameters: resource, startDate, endDate',
      );
    }

    try {
      return await this.fitbitService.getActivityTimeSeriesByDateRange(
        accessToken,
        resource,
        startDate,
        endDate,
      );
    } catch (error) {
      throw new InternalServerErrorException('Failed to fetch time series', {
        cause: error,
      });
    }
  }

  @Get('heart-rate-intraday')
  async getHeartRateIntraday(
    @Headers('authorization') authorization: string,
    @Query('date') date: string,
    @Query('detailLevel') detailLevel: '1sec' | '1min' = '1min',
    @Query('startTime') startTime?: string,
    @Query('endTime') endTime?: string,
  ) {
    const accessToken = this.extractBearerToken(authorization);

    if (!date) {
      throw new BadRequestException('Required parameter: date');
    }

    try {
      return await this.fitbitService.getHeartRateIntraday(
        accessToken,
        date,
        detailLevel,
        startTime,
        endTime,
      );
    } catch (error) {
      throw new InternalServerErrorException(
        'Failed to fetch heart rate intraday',
        { cause: error },
      );
    }
  }

  // ----------------------------------
  // --------- WEBHOOK ----------------
  // ----------------------------------

  // TODO: verify webhook signature (X-Fitbit-Signature header) using HMAC-SHA1
  // See: https://dev.fitbit.com/build/reference/web-api/developer-guide/using-subscriptions/#Verifying-a-Webhook-Notification
  @Post('webhook')
  handleWebhook(@Body() body: FitbitWebhookNotification[]) {
    this.logger.log('Webhook received from Fitbit:', body);

    for (const notification of body) {
      // Emit internal event to process the update
      this.eventEmitter.emit('patient.data.updated', {
        patientId: notification.ownerId,
        type: notification.collectionType,
      });
    }

    return; // Fitbit expects 204 (No Content)
  }

  // Listener for webhook-triggered data updates
  @OnEvent('patient.data.updated')
  handlePatientDataUpdate(payload: { patientId: string; type: string }) {
    this.logger.log('Patient data updated:', payload);
    // Could trigger immediate polling for this specific patient
    // or schedule a priority update
  }

  // ----------------------------------
  // --------- SESSIONS ---------------
  // ----------------------------------

  // Adds a patient to a rehabilitation session
  @Post('session/:sessionId/patient')
  async addPatientToSession(
    @Param('sessionId') sessionId: string,
    @Body()
    body: {
      patientId: string;
      name: string;
      accessToken: string;
      refreshToken: string;
      userId: string;
    },
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
      await this.fitbitService.createSubscription(
        body.accessToken,
        body.patientId,
      );
    } catch (error) {
      this.logger.error('Failed to create subscription:', error);
    }

    return {
      message: 'Patient added to session',
      sessionId,
      patientId: body.patientId,
    };
  }

  @Delete('session/:sessionId/patient/:patientId')
  async removePatientFromSession(
    @Param('sessionId') sessionId: string,
    @Param('patientId') patientId: string,
  ) {
    const patients = this.sessionService.getSessionPatients(sessionId);
    const patient = patients.find((p) => p.id === patientId);

    if (patient) {
      try {
        await this.fitbitService.deleteSubscription(
          patient.accessToken,
          patientId,
        );
      } catch (error) {
        this.logger.error('Failed to delete subscription:', error);
      }
    }

    this.sessionService.removePatientFromSession(sessionId, patientId);
    return { message: 'Patient removed from session' };
  }

  // ----------------------------------
  // --------- SSE (REAL-TIME) --------
  // ----------------------------------

  @Sse('session/:sessionId/live')
  livePatientData(
    @Param('sessionId') sessionId: string,
  ): Observable<MessageEvent> {
    this.logger.log(`Doctor connected to session stream: ${sessionId}`);

    if (!this.sessionStreams.has(sessionId)) {
      this.sessionStreams.set(sessionId, new Subject<MessageEvent>());
    }

    const sessionSubject = this.sessionStreams.get(sessionId)!;

    // Avoid duplicate polling if already active for this session
    if (!this.sessionPolling.has(sessionId)) {
      const pollingInterval = interval(60000).pipe(
        switchMap(async () => {
          const patients = this.sessionService.getSessionPatients(sessionId);

          if (patients.length === 0) {
            return null;
          }

          const allData: PatientData[] = [];

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
                await new Promise((resolve) => setTimeout(resolve, 2000));
              }
            } catch (error) {
              this.logger.error(
                `Failed to fetch data for patient ${patient.id}:`,
                error instanceof Error ? error.message : error,
              );
            }
          }

          return allData;
        }),
        map(
          (data) =>
            ({
              data: JSON.stringify(data),
              type: 'patient-data',
            }) as MessageEvent,
        ),
      );

      const subscription = pollingInterval.subscribe((event) => {
        if (event.data !== 'null') {
          sessionSubject.next(event);
        }
      });

      this.sessionPolling.set(sessionId, subscription);
    }

    return sessionSubject.asObservable();
  }

  @Delete('session/:sessionId')
  async endSession(@Param('sessionId') sessionId: string) {
    const patients = this.sessionService.getSessionPatients(sessionId);

    for (const patient of patients) {
      try {
        await this.fitbitService.deleteSubscription(
          patient.accessToken,
          patient.id,
        );
      } catch (error) {
        this.logger.error('Failed to delete subscription:', error);
      }
    }

    // Unsubscribe polling to prevent memory leak
    const polling = this.sessionPolling.get(sessionId);
    if (polling) {
      polling.unsubscribe();
      this.sessionPolling.delete(sessionId);
    }

    const stream = this.sessionStreams.get(sessionId);
    if (stream) {
      stream.complete();
      this.sessionStreams.delete(sessionId);
    }

    this.sessionService.endSession(sessionId);
    return { message: 'Session ended' };
  }

  @Get('week')
  async getWeekData(
    @Headers('authorization') authorization: string,
    @Query('weekStart') weekStart: string, // yyyy-MM-dd
  ) {
    const accessToken = this.extractBearerToken(authorization);

    if (!weekStart) {
      throw new BadRequestException(
        'Required parameter: weekStart (yyyy-MM-dd)',
      );
    }

    try {
      return await this.fitbitService.getWeekDataByDay(accessToken, weekStart);
    } catch (error) {
      throw new InternalServerErrorException('Failed to fetch week data', {
        cause: error,
      });
    }
  }
}
