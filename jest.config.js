module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: ['src/**/*.js', '!src/index.js', '!src/init.js', '!src/config.js', '!src/version.json'],
  coverageThreshold: {
    global: {
      lines: 90,
      statements: 90,
      branches: 80,
      functions: 90,
    },
  },
  testMatch: ['**/*.test.js'],
};
