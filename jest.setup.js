// Optional: configure or set up a testing framework before each test.
// If you delete this file, remove `setupFilesAfterEnv` from `jest.config.js`

// Used for __tests__/testing-library.js
// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom'

// Mock Web APIs for Node.js environment
global.Request = class MockRequest {
  constructor(url, options = {}) {
    this.url = url
    this.method = options.method || 'GET'
    this.headers = new Headers(options.headers)
    this.body = options.body
  }
  
  async json() {
    return this.body ? JSON.parse(this.body) : {}
  }
}

global.Response = class MockResponse {
  constructor(body, options = {}) {
    this.body = body
    this.status = options.status || 200
    this.headers = new Headers(options.headers)
  }
  
  static json(data, options = {}) {
    return new MockResponse(JSON.stringify(data), {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers }
    })
  }
  
  async json() {
    return JSON.parse(this.body)
  }
}

global.Headers = class MockHeaders extends Map {
  constructor(init) {
    super()
    if (init) {
      if (Array.isArray(init)) {
        for (const [key, value] of init) {
          this.set(key, value)
        }
      } else if (typeof init === 'object') {
        for (const [key, value] of Object.entries(init)) {
          this.set(key, value)
        }
      }
    }
  }
  
  get(key) {
    return super.get(key.toLowerCase())
  }
  
  set(key, value) {
    return super.set(key.toLowerCase(), value)
  }
  
  has(key) {
    return super.has(key.toLowerCase())
  }
}

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

// Mock Next.js image component
jest.mock('next/image', () => ({
  __esModule: true,
  default: function MockImage(props) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img {...props} />
  },
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