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
  TENANT_STORAGE_CAPACITY_BYTES: 500 * 1024 * 1024,
  R2_ACCOUNT_ID: 'test_account_id',
  R2_ACCESS_KEY_ID: 'test_access_key_id',
  R2_SECRET_ACCESS_KEY: 'c'.repeat(64),
  R2_BUCKET: 'saas-store-uploads',
  R2_PUBLIC_URL: 'https://cdn.example.com',
  MAX_FILE_SIZE: 5 * 1024 * 1024,
  MAX_PRODUCT_IMAGES: 10,
  JWT_ACCESS_SECRET: 'a'.repeat(64),
  JWT_REFRESH_SECRET: 'b'.repeat(64),
  JWT_ACCESS_EXPIRES_IN: '5h',
  JWT_REFRESH_EXPIRES_IN: '7d',
  BCRYPT_ROUNDS: 12,
  LOG_LEVEL: 'debug',
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

  it('rejects a placeholder R2 secret in production', () => {
    const { error } = EnvSchema.validate(
      baseEnv({
        NODE_ENV: 'production',
        R2_SECRET_ACCESS_KEY: `change_me_${'d'.repeat(40)}`,
      }),
    );
    expect(error?.message).toContain('R2_SECRET_ACCESS_KEY');
  });

  it('accepts strong secrets in production', () => {
    const { error } = EnvSchema.validate(baseEnv({ NODE_ENV: 'production' }));
    expect(error).toBeUndefined();
  });
});
