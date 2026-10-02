import { buildEnv } from './env.mode';

const ORIGINAL = { ...process.env };

const setEnv = (values: Record<string, string | undefined>) => {
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
};

const populate = (overrides: Record<string, string | undefined> = {}) =>
  setEnv({
    NODE_ENV: 'development',
    APP_NAME: 'saas_store',
    APP_PORT: '4000',
    API_PREFIX: 'api',
    API_VERSION: 'v1',
    APP_ROOT_DOMAIN: 'localhost',
    DB_NAME: 'saas_store',
    DB_HOST: '127.0.0.1',
    DB_PORT: '5432',
    DB_USERNAME: 'postgres',
    DB_PASSWORD: 'postgres',
    DB_SYNCHRONIZE: 'true',
    DB_SYNCHRONIZE_TENANTS: 'false',
    DB_LOGGING: 'false',
    DB_SSL: 'false',
    TENANT_POOL_SIZE: '10',
    TENANT_STORAGE_CAPACITY_BYTES: '1000',
    JWT_ACCESS_SECRET: 'a',
    JWT_REFRESH_SECRET: 'b',
    JWT_ACCESS_EXPIRES_IN: '15m',
    JWT_REFRESH_EXPIRES_IN: '7d',
    BCRYPT_ROUNDS: '12',
    LOG_LEVEL: 'info',
    THROTTLE_TTL: '60',
    THROTTLE_LIMIT: '20',
    CORS_ORIGIN: 'http://localhost:5173',
    CORS_CREDENTIALS: 'true',
    R2_ACCOUNT_ID: 'account',
    R2_ACCESS_KEY_ID: 'key',
    R2_SECRET_ACCESS_KEY: 'secret',
    R2_BUCKET: 'bucket',
    R2_PUBLIC_URL: 'https://cdn.example.com/',
    MAX_FILE_SIZE: '5000',
    MAX_PRODUCT_IMAGES: '5',
    STRIPE_SECRET_KEY: 'sk',
    STRIPE_PUBLISHABLE_KEY: 'pk',
    STRIPE_WEBHOOK_SECRET: 'whsec',
    ...overrides,
  });

describe('buildEnv', () => {
  afterEach(() => {
    process.env = { ...ORIGINAL };
  });

  it('maps process.env into the typed groups', () => {
    populate();

    const env = buildEnv();

    expect(env.app).toEqual({
      env: 'development',
      name: 'saas_store',
      port: 4000,
      apiPrefix: 'api',
      apiVersion: 'v1',
      bootstrapSuperAdminEmail: undefined,
      bootstrapSuperAdminPassword: undefined,
      bootstrapSuperAdminName: undefined,
      rootDomain: 'localhost',
    });
    expect(env.db).toEqual(
      expect.objectContaining({
        name: 'saas_store',
        host: '127.0.0.1',
        port: 5432,
        synchronize: true,
        syncTenants: false,
        logging: false,
        ssl: false,
        tenantPoolSize: 10,
        tenantStorageCapacityBytes: 1000,
      }),
    );
    expect(env.files).toEqual({ maxFileSize: 5000, maxProductImages: 5 });
    expect(env.cors).toEqual({
      origin: 'http://localhost:5173',
      credentials: true,
    });
  });

  it('strips trailing slashes from the R2 public URL', () => {
    populate({ R2_PUBLIC_URL: 'https://cdn.example.com///' });
    expect(buildEnv().r2.publicUrl).toBe('https://cdn.example.com');
  });

  it('falls back to the saas_store issuer/audience', () => {
    populate({ JWT_ISSUER: undefined, JWT_AUDIENCE: undefined });
    const { jwt } = buildEnv();
    expect(jwt.issuer).toBe('saas_store');
    expect(jwt.audience).toBe('saas_store');
  });

  it('parses booleans case-insensitively', () => {
    populate({
      DB_SYNCHRONIZE: 'TRUE',
      DB_SYNCHRONIZE_TENANTS: 'True',
      DB_LOGGING: '1',
      DB_SSL: 'yes',
      CORS_CREDENTIALS: 'FALSE',
    });
    const env = buildEnv();
    expect(env.db.synchronize).toBe(true);
    expect(env.db.syncTenants).toBe(true);
    // only the literal "true" enables logging/ssl
    expect(env.db.logging).toBe(false);
    expect(env.db.ssl).toBe(false);
    expect(env.cors.credentials).toBe(false);
  });

  it('leaves tenantPoolSize undefined when unset', () => {
    populate({ TENANT_POOL_SIZE: undefined });
    expect(buildEnv().db.tenantPoolSize).toBeUndefined();
  });

  it('keeps optional bootstrap super admin fields', () => {
    populate({
      BOOTSTRAP_SUPER_ADMIN_EMAIL: 'root@test.dev',
      BOOTSTRAP_SUPER_ADMIN_PASSWORD: 'pw',
      BOOTSTRAP_SUPER_ADMIN_NAME: 'Root',
    });
    const { app } = buildEnv();
    expect(app.bootstrapSuperAdminEmail).toBe('root@test.dev');
    expect(app.bootstrapSuperAdminPassword).toBe('pw');
    expect(app.bootstrapSuperAdminName).toBe('Root');
  });

  it('defaults the stripe application fee to 0', () => {
    populate({ STRIPE_APPLICATION_FEE_BPS: undefined });
    expect(buildEnv().stripe.applicationFeeBps).toBe(0);
  });
});
