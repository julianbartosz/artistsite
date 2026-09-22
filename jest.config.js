const nextJest = require('next/jest')

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files
  dir: './',
})

// Add any custom config to be passed to Jest
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    // Handle module aliases (this will be automatically configured for you based on your tsconfig.json paths)
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testEnvironment: 'jest-environment-jsdom',
  // Surfaces exercised by unit tests (and hardened commerce/inventory libs).
  collectCoverageFrom: [
    'src/lib/orders.ts',
    'src/lib/inventory.ts',
    'src/lib/promo-codes.ts',
    'src/lib/commerce.ts',
    'src/lib/shipping.ts',
    'src/lib/config.ts',
    'src/lib/form-validation.ts',
    'src/lib/api-error-handler.ts',
    'src/lib/cart-recovery.ts',
    'src/lib/search-params.ts',
    'src/lib/commission-intake.ts',
    'src/lib/site-content-shared.ts',
    'src/lib/admin-content.ts',
    'src/lib/markdown.ts',
    'src/lib/image-variant-url.ts',
    'src/lib/collector-feed-token.ts',
  ],
  coverageReporters: ['text', 'lcov', 'html'],
  testMatch: [
    '<rootDir>/src/tests/**/*.{test,spec}.{js,jsx,ts,tsx}',
    '<rootDir>/src/**/__tests__/**/*.{js,jsx,ts,tsx}',
    '<rootDir>/src/**/*.{test,spec}.{js,jsx,ts,tsx}',
  ],
  testPathIgnorePatterns: ['<rootDir>/src/tests/e2e/', '<rootDir>/.next/'],
  modulePathIgnorePatterns: ['<rootDir>/.next/'],
  moduleDirectories: ['node_modules', '<rootDir>/'],
  testTimeout: 30000,
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig)