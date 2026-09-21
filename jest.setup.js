// Optional: configure or set up a testing framework before each test.
// If you delete this file, remove `setupFilesAfterEnv` from `jest.config.js`

// Used for __tests__/testing-library.js
// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom'

Object.assign(global, {
  Request: globalThis.Request,
  Response: globalThis.Response,
  Headers: globalThis.Headers,
  fetch: globalThis.fetch,
})

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
    // eslint-disable-next-line @next/next/no-img-element
    return <img {...props} />
  },
}))

// Mock environment variables
process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = 'pk_test_mock'
process.env.NEXTAUTH_SECRET = 'test-secret'
process.env.NEXTAUTH_URL = 'http://localhost:3000'

jest.mock('server-only', () => ({}))

jest.mock('sanitize-html', () => jest.fn((html) => html))

jest.mock('next/cache', () => ({
  unstable_cache: (fn) => fn,
  revalidatePath: jest.fn(),
  revalidateTag: jest.fn(),
}))

jest.mock('@/components/AnalyticsProvider', () => ({
  useNewsletterTracking: () => ({ trackFormView: jest.fn(), trackSignup: jest.fn() }),
  useEcommerceTracking: () => ({
    trackAddToCart: jest.fn(),
    trackRemoveFromCart: jest.fn(),
    trackViewItem: jest.fn(),
    trackBeginCheckout: jest.fn(),
    trackPurchase: jest.fn(),
  }),
}))

jest.mock('@/components/admin/CmsEditAnchor', () => ({
  __esModule: true,
  default: () => null,
}))

// Mock fetch globally
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