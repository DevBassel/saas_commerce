import * as joi from 'joi';

const PLACEHOLDER_SECRETS = [
  'change_me',
  'changeme',
  'secret',
  '123456',
  'password',
  'placeholder',
];

const secretRule = (label: string): joi.StringSchema =>
  joi
    .string()
    .min(32)
    .required()
    .custom((value: string, helpers) => {
      const ancestors = helpers.state.ancestors as Array<{
        NODE_ENV?: string;
      }>;
      const root = ancestors[0];
      if (root?.NODE_ENV !== 'production') return value;
      const lowered = value.toLowerCase();
      if (PLACEHOLDER_SECRETS.some((p) => lowered.includes(p))) {
        return helpers.error('any.invalid');
      }
      return value;
    })
    .messages({
      'string.min': `"${label}" must be at least 32 characters`,
      'any.invalid': `"${label}" must not contain a placeholder value in production`,
    });

export const EnvSchema = joi.object({
  // APP
  NODE_ENV: joi.string().valid('development', 'production', 'test').required(),
  APP_NAME: joi.string().required(),
  APP_PORT: joi.number().required(),
  API_PREFIX: joi.string().required(),
  API_VERSION: joi.string().required(),
  BOOTSTRAP_SUPER_ADMIN_EMAIL: joi.string().email().optional(),
  BOOTSTRAP_SUPER_ADMIN_PASSWORD: joi.string().optional(),
  BOOTSTRAP_SUPER_ADMIN_NAME: joi.string().optional(),
  APP_ROOT_DOMAIN: joi.string().required(),
  // DB
  DB_NAME: joi.string().required(),
  DB_HOST: joi.string().required(),
  DB_PORT: joi.number().required(),
  DB_USERNAME: joi.string().required(),
  DB_PASSWORD: joi.string().required(),
  DB_SYNCHRONIZE: joi.boolean().required(),
  DB_LOGGING: joi.boolean().required(),
  DB_SSL: joi.boolean().required(),
  TENANT_POOL_SIZE: joi.number().required(),
  // JWT
  JWT_ACCESS_SECRET: secretRule('JWT_ACCESS_SECRET'),
  JWT_REFRESH_SECRET: secretRule('JWT_REFRESH_SECRET'),
  JWT_ACCESS_EXPIRES_IN: joi.string().required(),
  JWT_REFRESH_EXPIRES_IN: joi.string().required(),
  JWT_ISSUER: joi.string().optional(),
  JWT_AUDIENCE: joi.string().optional(),
  //  Password Hashing
  BCRYPT_ROUNDS: joi.number().required(),

  // Logging
  LOG_LEVEL: joi.string().required(),
  // CORS
  CORS_ORIGIN: joi.string().required(),
  CORS_CREDENTIALS: joi.boolean().required(),
});
