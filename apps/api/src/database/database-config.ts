import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import { ConfigEnv } from '../common/config/config';
import { IENV } from '../common/config/env.interface';

const REQUIRED_DATABASE_ENV = [
  'DB_NAME',
  'DB_HOST',
  'DB_PORT',
  'DB_USERNAME',
  'DB_PASSWORD',
] as const;

export const createDatabaseConfig = (): ConfigService<IENV> => {
  const missing = REQUIRED_DATABASE_ENV.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`Missing database environment: ${missing.join(', ')}`);
  }

  return new ConfigService<IENV>(ConfigEnv());
};
