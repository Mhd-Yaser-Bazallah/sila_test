import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().port().default(3000),
  API_PREFIX: Joi.string().trim().min(1).default('api/v1'),
  CORS_ORIGIN: Joi.string().trim().min(1).default('*'),
  DATABASE_URL: Joi.string()
    .uri({ scheme: ['postgresql', 'postgres'] })
    .required(),
  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_EXPIRES_IN: Joi.string().trim().min(1).default('15m'),
  JWT_REFRESH_EXPIRES_IN: Joi.string().trim().min(1).default('7d'),
  UPLOAD_ROOT: Joi.string().trim().min(1).default('uploads'),
  PUBLIC_BASE_URL: Joi.string().uri().default('http://localhost:3000'),
  MAX_UPLOAD_SIZE_MB: Joi.number().integer().min(1).max(50).default(5),
});
