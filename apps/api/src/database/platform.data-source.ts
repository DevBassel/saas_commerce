import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { createDatabaseConfig } from './database-config';
import { buildPlatformDataSourceOptions } from './data-source-options';

const platformDataSource = new DataSource(
  buildPlatformDataSourceOptions(
    createDatabaseConfig(),
    process.env.TYPEORM_PLATFORM_SCHEMA ?? 'public',
  ),
);

export default platformDataSource;
