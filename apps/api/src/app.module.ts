import type { IncomingMessage } from 'http';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { TerminusModule } from '@nestjs/terminus';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import configuration from './config/configuration';
import { validateEnv } from './config/env.validation';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { RequestIdInterceptor } from './common/interceptors/request-id.interceptor';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { PrismaModule } from './prisma/prisma.module';
import { HealthController } from './modules/administration/health.controller';
import { InAppChannel } from './modules/notifications/channels/in-app.channel';
import { AuditWriterService } from './infrastructure/audit/audit-writer.service';
import { AuthModule } from './modules/auth/auth.module';
import { IdentityModule } from './modules/identity/identity.module';
import { AccessControlModule } from './modules/access-control/access-control.module';
import { AuditModule } from './modules/audit/audit.module';

/**
 * Root application module.
 *
 * Architecture note: global providers (exception filter, JWT guard, request-id
 * interceptor) are registered here via APP_* tokens so NestJS DI resolves them.
 * This keeps AppModule as the single source of truth for cross-cutting concerns.
 */
@Module({
  imports: [
    // ─── Config ──────────────────────────────────────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateEnv,
      ignoreEnvFile: process.env.NODE_ENV === 'production',
    }),

    // ─── Structured logging (pino) ────────────────────────────────────────────
    LoggerModule.forRootAsync({
      useFactory: (config: ConfigService) => {
        const isDev = config.get<string>('nodeEnv') !== 'production';
        return {
          pinoHttp: {
            level: config.get<string>('logLevel') ?? 'info',
            transport: isDev ? { target: 'pino-pretty', options: { colorize: true } } : undefined,
            customProps: (req: IncomingMessage) => ({
              requestId: req.headers['x-request-id'] as string | undefined,
            }),
          },
        };
      },
      inject: [ConfigService],
    }),

    // ─── Rate limiting ────────────────────────────────────────────────────────
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60_000, limit: 100 },
      { name: 'auth', ttl: 60_000, limit: 10 }, // stricter for auth endpoints
    ]),

    // ─── Domain events ────────────────────────────────────────────────────────
    EventEmitterModule.forRoot({ wildcard: true, delimiter: '.' }),

    // ─── Cron jobs ────────────────────────────────────────────────────────────
    ScheduleModule.forRoot(),

    // ─── Health checks ────────────────────────────────────────────────────────
    TerminusModule,

    // ─── Phase 1 Domain Modules ───────────────────────────────────────────────
    PrismaModule,
    AuthModule,
    IdentityModule,
    AccessControlModule,
    AuditModule,
  ],

  controllers: [HealthController],

  providers: [
    InAppChannel,
    AuditWriterService,

    // ─── Cross-cutting concerns registered globally ───────────────────────────
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: RequestIdInterceptor },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
