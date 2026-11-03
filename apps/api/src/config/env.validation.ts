// apps/api/src/config/env.validation.ts
// Validates required env vars at startup via @nestjs/config validateSchema
import { plainToInstance } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Min, validateSync } from 'class-validator';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

class EnvironmentVariables {
  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV: Environment = Environment.Development;

  @IsInt()
  @Min(1)
  @IsOptional()
  PORT: number = 3000;

  @IsString()
  DATABASE_URL!: string;

  @IsString()
  @IsOptional()
  APP_URL: string = 'http://localhost:5173';

  @IsString()
  @IsOptional()
  JWT_PRIVATE_KEY_BASE64: string = '';

  @IsString()
  @IsOptional()
  JWT_PUBLIC_KEY_BASE64: string = '';

  @IsString()
  @IsOptional()
  JWT_ACCESS_EXPIRY: string = '15m';

  @IsInt()
  @IsOptional()
  JWT_REFRESH_EXPIRY_DAYS: number = 7;

  @IsString()
  @IsOptional()
  REDIS_HOST: string = 'localhost';

  @IsInt()
  @IsOptional()
  REDIS_PORT: number = 6379;

  @IsString()
  @IsOptional()
  LOG_LEVEL: string = 'info';

  @IsInt()
  @IsOptional()
  AUTH_MAX_FAILED_ATTEMPTS: number = 5;

  @IsInt()
  @IsOptional()
  AUTH_LOCKOUT_MINUTES: number = 15;

  @IsInt()
  @IsOptional()
  AUTH_MAX_SESSIONS: number = 5;

  @IsInt()
  @IsOptional()
  AUTH_TEMP_PASSWORD_HOURS: number = 72;

  @IsString()
  @IsOptional()
  SEED_ADMIN_EMAIL?: string;

  @IsString()
  @IsOptional()
  SEED_ADMIN_PASSWORD?: string;
}

export function validateEnv(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validatedConfig, { skipMissingProperties: false });
  if (errors.length > 0) {
    throw new Error(`Environment validation failed:\n${errors.toString()}`);
  }
  return validatedConfig;
}
