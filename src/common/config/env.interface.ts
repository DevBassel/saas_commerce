export interface IENV {
  app: IAPP;
  db: IDB;
  jwt: IJWT;
  bcrypt: {
    rounds: number;
  };
  log: Ilog;
  cors: ICORS;
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
