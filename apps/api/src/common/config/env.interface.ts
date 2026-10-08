export interface IENV {
  app: IAPP;
  db: IDB;
  jwt: IJWT;
  bcrypt: {
    rounds: number;
  };
  log: Ilog;
  throttling: IThrottling;
  cors: ICORS;
  r2: IR2;
  files: IFiles;
  stripe: IStripe;
  seeding: ISeeding;
  otp: IOtp;
  email: IEmail;
}

export interface IOtp {
  length: number;
  expirationSeconds: number;
  maxAttempts: number;
  resendCooldownSeconds: number;
  maxRequests: number;
  requestWindowSeconds: number;
  hashSecret: string;
  requireEmailVerified: boolean;
}

export type EmailProvider = 'smtp' | 'log' | 'memory';

export interface IEmail {
  provider: EmailProvider;
  fromAddress: string;
  fromName: string;
  smtp: {
    host?: string;
    port?: number;
    user?: string;
    password?: string;
    secure: boolean;
  };
}

export interface ISeeding {
  allowProduction: boolean;
}

export interface IAPP {
  env: string;
  name: string;
  port: number;
  apiPrefix: string;
  apiVersion: string;
  bootstrapSuperAdminEmail?: string;
  bootstrapSuperAdminPassword?: string;
  bootstrapSuperAdminName?: string;
  rootDomain?: string;
}

export interface IDB {
  name: string;
  host: string;
  port: number;
  username: string;
  password: string;
  synchronize: boolean;
  syncTenants: boolean;
  logging: boolean;
  ssl: boolean;
  tenantPoolSize?: number;
  tenantStorageCapacityBytes: number;
  tenantDbCapacityBytes: number;
}

export interface IJWT {
  accessSecret: string;
  refreshSecret: string;
  accessExpiresIn: string;
  refreshExpiresIn: string;
  issuer: string;
  audience: string;
}

export interface Ilog {
  level: string;
}

export interface ICORS {
  origin: string;
  credentials: boolean;
}

export interface IR2 {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicUrl: string;
}

export interface IFiles {
  maxFileSize: number;
  maxProductImages: number;
}

export interface IStripe {
  secretKey: string;
  publishableKey: string;
  webhookSecret: string;
  applicationFeeBps: number;
  onboardingReturnUrl?: string;
  onboardingRefreshUrl?: string;
}

export interface IThrottling {
  ttl: number;
  limit: number;
}
