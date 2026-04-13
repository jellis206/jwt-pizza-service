module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: ['src/**/*.js', '!src/index.js', '!src/init.js', '!src/config.js', '!src/version.json'],
  coverageThreshold: {
    global: {
      lines: 70,
      statements: 70,
      branches: 70,
      functions: 70,
    },
  },
  testMatch: ['**/*.test.js'],
};
