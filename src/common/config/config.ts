import { IENV } from './env.interface';
import { buildEnv } from './env.mode';

export const ConfigEnv = (): IENV => {
  const env = process.env.NODE_ENV || 'development';
  console.log(`Config [${env}] ENV loading...`);
  return buildEnv();
};
