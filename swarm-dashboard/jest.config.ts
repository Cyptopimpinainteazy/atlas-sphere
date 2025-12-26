import type {Config} from '@jest/types';

const config: Config.InitialOptions = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  testMatch: ['**/__tests__/**/*.(spec|test).ts?(x)', '**/?(*.)+(spec|test).ts?(x)', '**/tests/**/*.test.[jt]s?(x)'],
  transform: {
    '^.+\\.(t|j)sx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/tsconfig.json',
      diagnostics: false
    }
  },
  collectCoverage: true,
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: ['lcov', 'text', 'html'],
  coverageThreshold: {
    global: {
      branches: 8,
      functions: 34,
      lines: 38,
      statements: 36
    }
  },


  moduleDirectories: ['node_modules', '<rootDir>/src'],
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/src/$1'
  }
};

export default config;
