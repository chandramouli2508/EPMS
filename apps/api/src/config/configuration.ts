// apps/api/src/config/configuration.ts
// Typed environment configuration loaded via @nestjs/config

export interface AppConfig {
  nodeEnv: string;
  port: number;
  appUrl: string;
  logLevel: string;
  database: {
    url: string;
  };
  jwt: {
    privateKey: string;
    publicKey: string;
    accessExpiry: string;
    refreshExpiryDays: number;
  };
  redis: {
    host: string;
    port: number;
    password?: string;
  };
}

export default (): AppConfig => {
  const privateKeyBase64 = process.env.JWT_PRIVATE_KEY_BASE64 ?? '';
  const publicKeyBase64 = process.env.JWT_PUBLIC_KEY_BASE64 ?? '';

  return {
    nodeEnv: process.env.NODE_ENV ?? 'development',
    port: parseInt(process.env.PORT ?? '3000', 10),
    appUrl: process.env.APP_URL ?? 'http://localhost:5173',
    logLevel: process.env.LOG_LEVEL ?? 'info',
    database: {
      url: process.env.DATABASE_URL ?? '',
    },
    jwt: {
      privateKey: privateKeyBase64
        ? Buffer.from(privateKeyBase64, 'base64').toString('utf-8')
        : '',
      publicKey: publicKeyBase64
        ? Buffer.from(publicKeyBase64, 'base64').toString('utf-8')
        : '',
      accessExpiry: process.env.JWT_ACCESS_EXPIRY ?? '15m',
      refreshExpiryDays: parseInt(process.env.JWT_REFRESH_EXPIRY_DAYS ?? '7', 10),
    },
    redis: {
      host: process.env.REDIS_HOST ?? 'localhost',
      port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
      password: process.env.REDIS_PASSWORD,
    },
  };
};
