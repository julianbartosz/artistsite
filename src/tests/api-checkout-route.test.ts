import { POST as checkoutPost } from '@/app/api/checkout/route'
import { GET as checkoutSuccessGet } from '@/app/api/checkout/success/route'

// Mocks
const mockedCreate = jest.fn()
const mockedRetrieve = jest.fn()
const mockedCreateOrderFromSession = jest.fn()
jest.mock('@domain/orders', () => ({
  StripePaymentService: {
    createCheckoutSession: (...args: any[]) => mockedCreate(...args),
    retrieveCheckoutSession: (...args: any[]) => mockedRetrieve(...args),
  },
  OrderService: {
    createOrderFromStripeSession: (...args: any[]) => mockedCreateOrderFromSession(...args),
  },
}))

describe('Checkout API Routes', () => {
  beforeEach(() => {
    mockedCreate.mockReset()
    mockedRetrieve.mockReset()
    mockedCreateOrderFromSession.mockReset()
  })

  function jsonRequest(url: string, method: string, body?: unknown, headers: Record<string, string> = {}) {
    return new Request(url, {
      method,
      body: body ? JSON.stringify(body) : undefined,
      headers: { 'content-type': 'application/json', ...headers },
    })
  }

  it('POST /api/checkout creates a Stripe session via service and returns sessionId', async () => {
    mockedCreate.mockResolvedValue({ id: 'sess_123' })
    const payload = {
      items: [
        { product: { id: 'p1', title: 'Art', price: 123 }, quantity: 1 },
      ],
      customerInfo: { email: 'buyer@example.com' },
      subtotal: 123,
      shipping: 10,
      tax: 8,
      total: 141,
    }
    const req = jsonRequest('http://localhost:3000/api/checkout', 'POST', payload)
    const res = await checkoutPost(req)
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.sessionId).toBe('sess_123')
    expect(mockedCreate).toHaveBeenCalledTimes(1)
  })

  it('GET /api/checkout/success validates session and persists order', async () => {
    mockedRetrieve.mockResolvedValue({ id: 'sess_abc', payment_status: 'paid', amount_total: 14100 })
    mockedCreateOrderFromSession.mockResolvedValue({ id: 'ord_1', orderNumber: 'ART-ABC' })
    const req = jsonRequest('http://localhost:3000/api/checkout/success?session_id=sess_abc', 'GET')
    const res = await checkoutSuccessGet(req)
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.orderId).toBe('ord_1')
    expect(data.orderNumber).toBe('ART-ABC')
    expect(data.sessionId).toBe('sess_abc')
    expect(mockedRetrieve).toHaveBeenCalledWith('sess_abc')
    expect(mockedCreateOrderFromSession).toHaveBeenCalledTimes(1)
  })
})
