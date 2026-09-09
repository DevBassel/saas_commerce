export interface IENV {
  app: IAPP;
  db: IDB;
  jwt: IJWT;
  bcrypt: {
    rounds: number;
  };
  redis: IREDIS;
  mail: IMAIl;
  stripe: Istripe;
  throttle: Ithrottle;
  log: Ilog;

  files: IFiles;
  cors: ICORS;
}

export interface IAPP {
  env: string;
  name: string;
  port: number;
  apiPrefix: string;
  apiVersion: string;
  bootstrapStoreOwnerEmail?: string;
  bootstrapSuperAdminEmail?: string;
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
}

export interface IJWT {
  accessSecret: string;
  accessExpiresIn: string;
  refreshExpiresIn: string;
}

export interface IREDIS {
  host: string;
  port: number;
  password: string;
  db: number;
  ttl: number;
}
export interface IMAIl {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  from: string;
}

export interface Istripe {
  secretKey: string;
  webhookSecret: string;
  publicKey: string;
}

export interface Ithrottle {
  ttl: number;
  limit: number;
}

export interface Ilog {
  level: string;
}

export interface IFiles {
  maxFileSize: number;
  maxFiles: number;
}

export interface ICORS {
  origin: string;
  credentials: boolean;
}
