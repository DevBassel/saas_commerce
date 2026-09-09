import { IENV } from './env.interface';
import { development, testing, production } from './env.mode';

export const envs: Record<string, () => IENV> = {
  development,
  testing,
  production,
};

export const ConfigEnv = (): IENV => {
  const env = process.env.NODE_ENV || 'development';
  console.log(`Config [${env}] ENV loading...`);
  return envs[env]();
};
