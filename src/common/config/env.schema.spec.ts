import { EnvSchema } from './env.schema';

const baseEnv = (overrides: Record<string, unknown> = {}) => ({
  NODE_ENV: 'development',
  APP_NAME: 'saas_store',
  APP_PORT: 4000,
  API_PREFIX: 'api',
  API_VERSION: 'v1',
  APP_ROOT_DOMAIN: 'localhost',
  DB_NAME: 'saas_store',
  DB_HOST: '127.0.0.1',
  DB_PORT: 5432,
  DB_USERNAME: 'postgres',
  DB_PASSWORD: 'root',
  DB_SYNCHRONIZE: true,
  DB_LOGGING: true,
  DB_SSL: false,
  TENANT_POOL_SIZE: 5,
  JWT_ACCESS_SECRET: 'a'.repeat(64),
  JWT_REFRESH_SECRET: 'b'.repeat(64),
  JWT_ACCESS_EXPIRES_IN: '5h',
  JWT_REFRESH_EXPIRES_IN: '7d',
  BCRYPT_ROUNDS: 12,
  REDIS_HOST: 'localhost',
  REDIS_PORT: 6379,
  REDIS_PASSWORD: 'x',
  REDIS_DB: 0,
  CACHE_TTL: 300,
  MAIL_HOST: 'smtp.example.com',
  MAIL_PORT: 587,
  MAIL_SECURE: false,
  MAIL_USER: 'user',
  MAIL_PASSWORD: 'pass',
  MAIL_FROM: 'noreply@example.com',
  STRIPE_SECRET_KEY: 'sk_test',
  STRIPE_WEBHOOK_SECRET: 'whsec',
  STRIPE_PUBLIC_KEY: 'pk_test',
  THROTTLE_TTL: 60,
  THROTTLE_LIMIT: 100,
  LOG_LEVEL: 'debug',
  MAX_FILE_SIZE: 5242880,
  MAX_FILES: 20,
  CORS_ORIGIN: 'http://localhost:3000',
  CORS_CREDENTIALS: true,
  ...overrides,
});

describe('EnvSchema', () => {
  it('accepts a valid development config', () => {
    const { error } = EnvSchema.validate(baseEnv());
    expect(error).toBeUndefined();
  });

  it('rejects a secret shorter than 32 characters even in development', () => {
    const { error } = EnvSchema.validate(
      baseEnv({ JWT_ACCESS_SECRET: 'short' }),
    );
    expect(error?.message).toContain('JWT_ACCESS_SECRET');
  });

  it('rejects a placeholder refresh secret in production', () => {
    const { error } = EnvSchema.validate(
      baseEnv({
        NODE_ENV: 'production',
        JWT_REFRESH_SECRET: `change_me_${'c'.repeat(40)}`,
      }),
    );
    expect(error?.message).toContain('JWT_REFRESH_SECRET');
  });

  it('rejects a placeholder access secret in production', () => {
    const { error } = EnvSchema.validate(
      baseEnv({
        NODE_ENV: 'production',
        JWT_ACCESS_SECRET: `change_me_${'a'.repeat(40)}`,
      }),
    );
    expect(error?.message).toContain('JWT_ACCESS_SECRET');
  });

  it('accepts strong secrets in production', () => {
    const { error } = EnvSchema.validate(baseEnv({ NODE_ENV: 'production' }));
    expect(error).toBeUndefined();
  });
});
