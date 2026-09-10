import { IENV } from './env.interface';

const buildEnv = (): IENV => ({
  app: {
    env: process.env.NODE_ENV!,
    name: process.env.APP_NAME!,
    port: Number(process.env.APP_PORT),
    apiPrefix: process.env.API_PREFIX!,
    apiVersion: process.env.API_VERSION!,
    bootstrapStoreOwnerEmail:
      process.env.BOOTSTRAP_STORE_OWNER_EMAIL || undefined,
    bootstrapSuperAdminEmail:
      process.env.BOOTSTRAP_SUPER_ADMIN_EMAIL || undefined,
    bootstrapSuperAdminPassword:
      process.env.BOOTSTRAP_SUPER_ADMIN_PASSWORD || undefined,
    bootstrapSuperAdminName:
      process.env.BOOTSTRAP_SUPER_ADMIN_NAME || undefined,
    rootDomain: process.env.APP_ROOT_DOMAIN || undefined,
  },
  db: {
    name: process.env.DB_NAME!,
    host: process.env.DB_HOST!,
    port: Number(process.env.DB_PORT),
    username: process.env.DB_USERNAME!,
    password: process.env.DB_PASSWORD!,
    synchronize:
      String(process.env.DB_SYNCHRONIZE).toLocaleLowerCase() === 'true',
    logging: String(process.env.DB_LOGGING).toLocaleLowerCase() === 'true',
    ssl: String(process.env.DB_SSL).toLocaleLowerCase() === 'true',
    tenantPoolSize: process.env.TENANT_POOL_SIZE
      ? Number(process.env.TENANT_POOL_SIZE)
      : undefined,
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET!,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN!,
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN!,
  },
  bcrypt: {
    rounds: Number(process.env.BCRYPT_ROUNDS),
  },
  redis: {
    host: process.env.REDIS_HOST!,
    port: Number(process.env.REDIS_PORT),
    password: process.env.REDIS_PASSWORD!,
    db: Number(process.env.REDIS_DB),
    ttl: Number(process.env.CACHE_TTL),
  },

  mail: {
    host: process.env.MAIL_HOST!,
    port: Number(process.env.MAIL_PORT),
    secure: String(process.env.MAIL_SECURE).toLocaleLowerCase() === 'true',
    user: process.env.MAIL_USER!,
    password: process.env.MAIL_PASSWORD!,
    from: process.env.MAIL_FROM!,
  },
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY!,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
    publicKey: process.env.STRIPE_PUBLIC_KEY!,
  },
  throttle: {
    ttl: Number(process.env.THROTTLE_TTL),
    limit: Number(process.env.THROTTLE_LIMIT),
  },

  log: {
    level: process.env.LOG_LEVEL!,
  },
  files: {
    maxFileSize: Number(process.env.MAX_FILE_SIZE),
    maxFiles: Number(process.env.MAX_FILES),
  },
  cors: {
    origin: process.env.CORS_ORIGIN!,
    credentials:
      String(process.env.CORS_CREDENTIALS).toLocaleLowerCase() === 'true',
  },
  admin: {
    rootPath: process.env.ADMINJS_ROOT_PATH || '/admin',
    cookieName: process.env.ADMINJS_COOKIE_NAME || 'saas_admin',
    cookiePassword: process.env.ADMINJS_COOKIE_PASSWORD!,
    sessionSecret: process.env.ADMINJS_SESSION_SECRET!,
  },
});

export const development = (): IENV => ({
  ...buildEnv(),
  app: { ...buildEnv().app, env: 'development' },
});

export const testing = (): IENV => ({
  ...buildEnv(),
  app: { ...buildEnv().app, env: 'testing' },
});

export const production = (): IENV => ({
  ...buildEnv(),
  app: { ...buildEnv().app, env: 'production' },
});
