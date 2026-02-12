import Joi from 'joi';

export const validationSchema = {
  DB_TYPE: Joi.string()
    .valid('postgres', 'mysql', 'sqlite', 'mariadb', 'mongodb')
    .default('postgres'),
  DB_HOST: Joi.string().default('localhost'),
  DB_PORT: Joi.number().default(5432),
  DB_USERNAME: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_NAME: Joi.string().required(),
};
