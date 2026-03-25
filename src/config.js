require('dotenv').config();

module.exports = {
  jwtSecret: process.env.JWT_SECRET,
  db: {
    connection: {
      host: process.env.DB_HOST || '127.0.0.1',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE || 'pizza',
      connectTimeout: parseInt(process.env.DB_CONNECT_TIMEOUT || '60000'),
    },
    listPerPage: parseInt(process.env.DB_LIST_PER_PAGE || '10'),
  },
  factory: {
    url: process.env.FACTORY_URL || 'https://pizza-factory.cs329.click',
    apiKey: process.env.FACTORY_API_KEY,
  },
  metrics: {
    source: process.env.METRICS_SOURCE || 'jwt-pizza-service-dev',
    endpointUrl: process.env.METRICS_ENDPOINT_URL || '',
    userId: process.env.METRICS_USER_ID || '',
    apiKey: process.env.METRICS_API_KEY || '',
  },
  logging: {
    source: process.env.LOGGING_SOURCE || 'jwt-pizza-service-logging-dev',
    endpointUrl: process.env.LOGGING_ENDPOINT_URL || 'logging-endpoint-placeholder',
    accountId: process.env.LOGGING_ACCOUNT_ID || 'logging-account-placeholder',
    apiKey: process.env.LOGGING_API_KEY || 'logging-api-key-placeholder',
  },
};
