import { ConfigService } from '@nestjs/config';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { TypeOrmDailyLogger } from '../logger/typeorm-daily.logger';
import { IDB, IENV } from './env.interface';

export interface DataSourceOverrides {
  schema?: string;
  entities?: PostgresConnectionOptions['entities'];
  synchronize?: boolean;
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
  const { name, host, port, username, password, synchronize, ssl } =
    config.getOrThrow<IDB>('db');

  return {
    type: 'postgres',
    host,
    port,
    username,
    password: password,
    database: name,
    ssl,
    logging: 'all',
    logger: getSharedLogger(),
    synchronize: overrides.synchronize ?? synchronize,
    ...(overrides.schema ? { schema: overrides.schema } : {}),
    ...(overrides.entities ? { entities: overrides.entities } : {}),
    ...(overrides.poolSize ? { poolSize: overrides.poolSize } : {}),
  };
};
