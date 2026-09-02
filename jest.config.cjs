// Prayer times are computed in the device's local timezone, so the schedule
// assertions only mean something against a fixed one.
process.env.TZ = 'America/New_York';

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/*.test.ts'],
  modulePathIgnorePatterns: ['<rootDir>/android/', '<rootDir>/ios/'],
};
