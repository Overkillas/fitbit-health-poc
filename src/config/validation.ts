import Joi from "joi";

export const validationSchema = {
  DB_TYPE: Joi.string().valid('postgres', 'mysql', 'sqlite', 'mariadb', 'mongodb').default('postgres'),
  DB_HOST: Joi.string().default('localhost'),
  DB_PORT: Joi.number().default(5432),
  DB_USERNAME: Joi.string().default('user'),
  DB_PASSWORD: Joi.string().default('password'),
  DB_NAME: Joi.string().default('fitbit_db'),
};