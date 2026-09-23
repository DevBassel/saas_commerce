export interface IENV {
  app: IAPP;
  db: IDB;
  jwt: IJWT;
  bcrypt: {
    rounds: number;
  };
  log: Ilog;
  cors: ICORS;
  r2: IR2;
  files: IFiles;
  payments: IPayments;
  stripe: IStripe;
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
  logging: boolean;
  ssl: boolean;
  tenantPoolSize?: number;
  tenantStorageCapacityBytes: number;
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

export interface IPayments {
  provider: string;
}

export interface IStripe {
  secretKey?: string;
  publishableKey?: string;
  webhookSecret?: string;
  currency: string;
  applicationFeeBps: number;
  connectCountry: string;
  onboardingReturnUrl?: string;
  onboardingRefreshUrl?: string;
}
