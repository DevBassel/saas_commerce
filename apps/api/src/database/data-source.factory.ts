import { ConfigService } from '@nestjs/config';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { TypeOrmDailyLogger } from '../common/logger/typeorm-daily.logger';
import { IDB, IENV } from '../common/config/env.interface';

export interface DataSourceOverrides {
  schema?: string;
  entities?: PostgresConnectionOptions['entities'];
  poolSize?: number;
}

let sharedLogger: TypeOrmDailyLogger | undefined;

const getSharedLogger = (): TypeOrmDailyLogger => {
  sharedLogger ??= new TypeOrmDailyLogger('all');
  return sharedLogger;
};

export const buildDataSourceOptions = (
  config: ConfigService<IENV>,
  overrides: DataSourceOverrides = {},
): PostgresConnectionOptions => {
  const {
    name,
    host,
    port,
    username,
    password,
    logging,
    ssl,
    statementTimeoutMs,
  } = config.getOrThrow<IDB>('db');

  return {
    type: 'postgres',
    host,
    port,
    username,
    password: password,
    database: name,
    ssl,
    logging,
    logger: getSharedLogger(),
    synchronize: false,
    migrationsRun: false,
    ...(statementTimeoutMs > 0
      ? { extra: { statement_timeout: statementTimeoutMs } }
      : {}),
    ...(overrides.schema ? { schema: overrides.schema } : {}),
    ...(overrides.entities ? { entities: overrides.entities } : {}),
    ...(overrides.poolSize ? { poolSize: overrides.poolSize } : {}),
  };
};
