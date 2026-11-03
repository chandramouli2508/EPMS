// apps/api/src/main.ts
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // ─── Structured pino logger ───────────────────────────────────────────────
  app.useLogger(app.get(Logger));

  const config = app.get(ConfigService);
  const appUrl = config.get<string>('appUrl') ?? 'http://localhost:5173';
  const port = config.get<number>('port') ?? 3000;
  const isDev = config.get<string>('nodeEnv') !== 'production';

  // ─── Security headers ─────────────────────────────────────────────────────
  app.use(
    helmet({
      // Allow Swagger UI to load its own assets in development
      contentSecurityPolicy: isDev ? false : undefined,
    }),
  );

  // ─── Cookie parser (required for HttpOnly refresh cookie) ─────────────────
  // Decision: cookie-parser is needed before any middleware reads req.cookies.
  app.use(cookieParser());

  // ─── CORS ─────────────────────────────────────────────────────────────────
  // Never use '*'. Origin is always the explicit APP_URL so the refresh cookie
  // is treated as same-site by the browser (dev proxy makes them same-origin).
  app.enableCors({
    origin: appUrl,
    credentials: true,
    allowedHeaders: ['Authorization', 'Content-Type', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id'],
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  // ─── Global prefix and URI versioning ────────────────────────────────────
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  // ─── Global ValidationPipe ────────────────────────────────────────────────
  // whitelist: strip unknown properties
  // forbidNonWhitelisted: error on unknown properties (prevents mass-assignment)
  // transform: auto-convert plain objects to DTO class instances
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // ─── Swagger / OpenAPI ────────────────────────────────────────────────────
  if (isDev) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('EPMS API')
      .setDescription('Engineering Project Management System — REST API')
      .setVersion('1.0')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' })
      .addCookieAuth('refreshToken')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  await app.listen(port);
  const logger = app.get(Logger);
  logger.log(`EPMS API running on port ${port}`);
  logger.log(`Swagger UI: http://localhost:${port}/api/docs`);
}

bootstrap();
