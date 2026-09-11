import { IENV } from './env.interface';

export const buildEnv = (): IENV => ({
  app: {
    env: process.env.NODE_ENV!,
    name: process.env.APP_NAME!,
    port: Number(process.env.APP_PORT),
    apiPrefix: process.env.API_PREFIX!,
    apiVersion: process.env.API_VERSION!,
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
    refreshSecret: process.env.JWT_REFRESH_SECRET!,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN!,
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN!,
    issuer: process.env.JWT_ISSUER || 'saas_store',
    audience: process.env.JWT_AUDIENCE || 'saas_store',
  },
  bcrypt: {
    rounds: Number(process.env.BCRYPT_ROUNDS),
  },
  log: {
    level: process.env.LOG_LEVEL!,
  },
  cors: {
    origin: process.env.CORS_ORIGIN!,
    credentials:
      String(process.env.CORS_CREDENTIALS).toLocaleLowerCase() === 'true',
  },
});
