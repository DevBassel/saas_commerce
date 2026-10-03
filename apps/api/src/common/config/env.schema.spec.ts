import { EnvSchema } from './env.schema';

const SECRET = `a1b2c3d4e5f6${'a'.repeat(40)}`;

const baseEnv = (): Record<string, unknown> => ({
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
  DB_PASSWORD: 'postgres',
  DB_SYNCHRONIZE: true,
  DB_LOGGING: false,
  DB_SSL: false,
  TENANT_POOL_SIZE: 10,
  TENANT_STORAGE_CAPACITY_BYTES: 1_000_000,
  TENANT_DB_CAPACITY_BYTES: 2_000_000,
  R2_ACCOUNT_ID: 'account',
  R2_ACCESS_KEY_ID: 'key',
  R2_SECRET_ACCESS_KEY: SECRET,
  R2_BUCKET: 'bucket',
  R2_PUBLIC_URL: 'https://cdn.example.com',
  MAX_FILE_SIZE: 5_000_000,
  MAX_PRODUCT_IMAGES: 5,
  JWT_ACCESS_SECRET: SECRET,
  JWT_REFRESH_SECRET: `${SECRET}b`,
  JWT_ACCESS_EXPIRES_IN: '15m',
  JWT_REFRESH_EXPIRES_IN: '7d',
  BCRYPT_ROUNDS: 12,
  LOG_LEVEL: 'info',
  THROTTLE_TTL: 60,
  THROTTLE_LIMIT: 20,
  CORS_ORIGIN: 'http://localhost:5173',
  CORS_CREDENTIALS: true,
  STRIPE_SECRET_KEY: `sk_test_${SECRET}`,
  STRIPE_PUBLISHABLE_KEY: 'pk_test_123',
  STRIPE_WEBHOOK_SECRET: `whsec_${SECRET}`,
});

const validate = (overrides: Record<string, unknown> = {}) =>
  EnvSchema.validate(
    { ...baseEnv(), ...overrides },
    { abortEarly: false, allowUnknown: true },
  );

const errorKeys = (result: {
  error?: { details: Array<{ path: Array<string | number> }> };
}) => result.error?.details.map((d) => d.path.join('.')) ?? [];

describe('EnvSchema', () => {
  it('accepts a complete development environment', () => {
    const result = validate();
    expect(result.error).toBeUndefined();
  });

  it('defaults DB_SYNCHRONIZE_TENANTS to false', () => {
    const result = validate() as unknown as { value: Record<string, unknown> };
    expect(result.value.DB_SYNCHRONIZE_TENANTS).toBe(false);
  });

  it('defaults STRIPE_APPLICATION_FEE_BPS to 0', () => {
    const result = validate() as unknown as { value: Record<string, unknown> };
    expect(result.value.STRIPE_APPLICATION_FEE_BPS).toBe(0);
  });

  it('rejects an invalid NODE_ENV', () => {
    expect(errorKeys(validate({ NODE_ENV: 'staging' }))).toContain('NODE_ENV');
  });

  it('requires the mandatory app/db keys', () => {
    const result = EnvSchema.validate(
      { ...baseEnv(), APP_NAME: undefined, DB_HOST: undefined },
      { abortEarly: false, allowUnknown: true },
    );
    expect(errorKeys(result)).toContain('APP_NAME');
    expect(errorKeys(result)).toContain('DB_HOST');
  });

  it('rejects a secret shorter than 32 characters', () => {
    const result = validate({ JWT_ACCESS_SECRET: 'too-short' });
    expect(errorKeys(result)).toContain('JWT_ACCESS_SECRET');
  });

  it('rejects an out-of-range Stripe application fee', () => {
    expect(
      errorKeys(validate({ STRIPE_APPLICATION_FEE_BPS: 10001 })),
    ).toContain('STRIPE_APPLICATION_FEE_BPS');
  });

  describe('in production', () => {
    it('requires JWT issuer and audience', () => {
      const result = validate({
        NODE_ENV: 'production',
        JWT_ISSUER: undefined,
        JWT_AUDIENCE: undefined,
      });
      expect(errorKeys(result)).toContain('JWT_ISSUER');
      expect(errorKeys(result)).toContain('JWT_AUDIENCE');
    });

    it('rejects placeholder secrets', () => {
      const result = validate({
        NODE_ENV: 'production',
        JWT_ISSUER: 'saas_store',
        JWT_AUDIENCE: 'saas_store',
        JWT_ACCESS_SECRET: `change_me_${'x'.repeat(40)}`,
      });
      expect(errorKeys(result)).toContain('JWT_ACCESS_SECRET');
    });

    it('accepts strong secrets with explicit issuer/audience', () => {
      const result = validate({
        NODE_ENV: 'production',
        JWT_ISSUER: 'saas_store',
        JWT_AUDIENCE: 'saas_store',
      });
      expect(result.error).toBeUndefined();
    });
  });

  describe('in development', () => {
    it('does not require explicit issuer/audience', () => {
      const result = validate({
        JWT_ISSUER: undefined,
        JWT_AUDIENCE: undefined,
      });
      expect(result.error).toBeUndefined();
    });

    it('tolerates a secret containing a placeholder word', () => {
      const result = validate({
        JWT_ACCESS_SECRET: `my_secret_${'x'.repeat(40)}`,
      });
      expect(errorKeys(result)).not.toContain('JWT_ACCESS_SECRET');
    });
  });
});
