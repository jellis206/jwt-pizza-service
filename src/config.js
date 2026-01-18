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
};
