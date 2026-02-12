export default () => {
  const required = (key: string): string => {
    const value = process.env[key];
    if (!value) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
    return value;
  };

  return {
    database: {
      type: process.env.DB_TYPE || 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: required('DB_USERNAME'),
      password: required('DB_PASSWORD'),
      database: required('DB_NAME'),
    },
  };
};
