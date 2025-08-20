// Optional: configure or set up a testing framework before each test.
// If you delete this file, remove `setupFilesAfterEnv` from `jest.config.js`

// Used for __tests__/testing-library.js
// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom'
import 'whatwg-fetch'

// Remove custom Web API class shims to avoid conflicts with NextRequest
// (JSDOM/Node 20 provide these natively; tests can mock fetch per-case)

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
      forward: jest.fn(),
      refresh: jest.fn(),
    }
  },
  useSearchParams() {
    return new URLSearchParams()
  },
  usePathname() {
    return '/'
  },
}))

// Mock Next.js Image component
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props) => {
    const { fill, priority, sizes, ...rest } = props || {};
    // eslint-disable-next-line @next/next/no-img-element
    return <img {...rest} />;
  },
}))

// Mock environment variables
process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = 'pk_test_mock'
process.env.NEXTAUTH_SECRET = 'test-secret'
process.env.NEXTAUTH_URL = 'http://localhost:3000'

// Mock fetch globally (tests may override per-suite)
// @ts-expect-error
global.fetch = jest.fn()

// Mock console methods to avoid noise in tests
const originalError = console.error
const originalLog = console.log
const originalGroup = console.group

beforeAll(() => {
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Warning: ReactDOM.render is deprecated') ||
       args[0].includes('Newsletter subscription error'))
    ) {
      return
    }
    originalError.call(console, ...args)
  }
  
  console.group = (...args) => {
    if (typeof args[0] === 'string' && args[0].includes('Error Details')) {
      return
    }
    originalGroup.call(console, ...args)
  }
})

afterAll(() => {
  console.error = originalError
  console.log = originalLog
  console.group = originalGroup
})

// Reset mocks between tests
beforeEach(() => {
  jest.clearAllMocks()
})