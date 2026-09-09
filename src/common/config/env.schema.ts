import * as joi from 'joi';

export const EnvSchema = joi.object({
  // APP
  NODE_ENV: joi.string().valid('development', 'production', 'test').required(),
  APP_NAME: joi.string().required(),
  APP_PORT: joi.number().required(),
  API_PREFIX: joi.string().required(),
  API_VERSION: joi.string().required(),
  BOOTSTRAP_STORE_OWNER_EMAIL: joi.string().email().optional(),
  BOOTSTRAP_SUPER_ADMIN_EMAIL: joi.string().email().optional(),
  // DB
  DB_NAME: joi.string().required(),
  DB_HOST: joi.string().required(),
  DB_PORT: joi.number().required(),
  DB_USERNAME: joi.string().required(),
  DB_PASSWORD: joi.string().required(),
  DB_SYNCHRONIZE: joi.boolean().required(),
  DB_LOGGING: joi.boolean().required(),
  DB_SSL: joi.boolean().required(),
  // JWT
  JWT_ACCESS_SECRET: joi.string().required(),
  JWT_ACCESS_EXPIRES_IN: joi.string().required(),
  JWT_REFRESH_EXPIRES_IN: joi.string().required(),
  //  Password Hashing
  BCRYPT_ROUNDS: joi.number().required(),
  // Redis
  REDIS_HOST: joi.string().required(),
  REDIS_PORT: joi.number().required(),
  REDIS_PASSWORD: joi.string().required(),
  REDIS_DB: joi.number().required(),
  // Cache
  CACHE_TTL: joi.number().required(),
  // Mail (SMTP)
  MAIL_HOST: joi.string().required(),
  MAIL_PORT: joi.number().required(),
  MAIL_SECURE: joi.boolean().required(),
  MAIL_USER: joi.string().required(),
  MAIL_PASSWORD: joi.string().required(),
  MAIL_FROM: joi.string().required(),
  // Stripe
  STRIPE_SECRET_KEY: joi.string().required(),
  STRIPE_WEBHOOK_SECRET: joi.string().required(),
  STRIPE_PUBLIC_KEY: joi.string().required(),
  // Rate Limiting
  THROTTLE_TTL: joi.number().required(),
  THROTTLE_LIMIT: joi.number().required(),

  // Logging
  LOG_LEVEL: joi.string().required(),
  // Files
  MAX_FILE_SIZE: joi.number().required(),
  MAX_FILES: joi.number().required(),
  // CORS
  CORS_ORIGIN: joi.string().required(),
  CORS_CREDENTIALS: joi.boolean().required(),
});
