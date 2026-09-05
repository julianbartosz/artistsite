'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useCart } from '@/components/CartContext';
import { formatPrice, productImageSrc, cartItemLineTotal, formatCartItemVariant, E2E_CHECKOUT_SESSION_PREFIX } from '@/lib/commerce';
import { DEFAULT_SHOP_PAGE } from '@/lib/site-content-shared';
import { loadStripe } from '@stripe/stripe-js';

interface CheckoutFormData {
  email: string;
  firstName: string;
  lastName: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone: string;
  promoCode: string;
}

type CheckoutStep = 'contact' | 'shipping' | 'review';

const CHECKOUT_STEPS: Array<{ id: CheckoutStep; label: string }> = [
  { id: 'contact', label: 'Contact' },
  { id: 'shipping', label: 'Shipping' },
  { id: 'review', label: 'Review & pay' },
];

export default function CheckoutPage() {
  const router = useRouter();
  const { state, getItemKey, closeCart } = useCart();
  const [formData, setFormData] = useState<CheckoutFormData>({
    email: '',
    firstName: '',
    lastName: '',
    address: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'US',
    phone: '',
    promoCode: '',
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [errors, setErrors] = useState<Partial<CheckoutFormData>>({});
  const [submitError, setSubmitError] = useState('');
  const [trustCopy, setTrustCopy] = useState(DEFAULT_SHOP_PAGE.checkoutTrustCopy);
  const [step, setStep] = useState<CheckoutStep>('contact');

  useEffect(() => {
    fetch('/api/site-content/public')
      .then((response) => response.json())
      .then((data) => {
        if (typeof data?.shop?.checkoutTrustCopy === 'string' && data.shop.checkoutTrustCopy.trim()) {
          setTrustCopy(data.shop.checkoutTrustCopy);
        }
      })
      .catch(() => undefined);
  }, []);

  // Close cart drawer when entering checkout (avoids overlay blocking the form)
  useEffect(() => {
    closeCart();
  }, [closeCart]);

  // Redirect if cart is empty
  useEffect(() => {
    if (state.isLoaded && state.items.length === 0) {
      router.push('/shop');
    }
  }, [state.isLoaded, state.items.length, router]);

  // Calculate totals
  const subtotal = state.total;
  const shipping = state.items.reduce((total, item) => {
    const shippingCost = formData.country === 'US'
      ? item.product.shipping.domestic
      : item.product.shipping.international;
    return total + (shippingCost * item.quantity);
  }, 0);
  const total = subtotal + shipping;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear error when user starts typing
    if (errors[name as keyof CheckoutFormData]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<CheckoutFormData> = {};

    if (!formData.email) newErrors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Email is invalid';
    
    if (!formData.firstName) newErrors.firstName = 'First name is required';
    if (!formData.lastName) newErrors.lastName = 'Last name is required';
    if (!formData.address) newErrors.address = 'Address is required';
    if (!formData.city) newErrors.city = 'City is required';
    if (!formData.state) newErrors.state = 'State is required';
    if (!formData.postalCode) newErrors.postalCode = 'Postal code is required';
    if (!formData.phone) newErrors.phone = 'Phone number is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateContactStep = (): boolean => {
    const newErrors: Partial<CheckoutFormData> = {};
    if (!formData.email) newErrors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Email is invalid';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateShippingStep = (): boolean => {
    const newErrors: Partial<CheckoutFormData> = {};
    if (!formData.firstName) newErrors.firstName = 'First name is required';
    if (!formData.lastName) newErrors.lastName = 'Last name is required';
    if (!formData.address) newErrors.address = 'Address is required';
    if (!formData.city) newErrors.city = 'City is required';
    if (!formData.state) newErrors.state = 'State is required';
    if (!formData.postalCode) newErrors.postalCode = 'Postal code is required';
    if (!formData.phone) newErrors.phone = 'Phone number is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const goToNextStep = () => {
    setSubmitError('');
    if (step === 'contact' && validateContactStep()) {
      setStep('shipping');
      return;
    }
    if (step === 'shipping' && validateShippingStep()) {
      setStep('review');
    }
  };

  const goToPreviousStep = () => {
    setSubmitError('');
    if (step === 'review') setStep('shipping');
    else if (step === 'shipping') setStep('contact');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    
    if (!validateForm()) return;

    setIsProcessing(true);

    try {
      // Create checkout session
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items: state.items,
          customerInfo: formData,
          promoCode: formData.promoCode,
        }),
      });

      const payload = await response.json();
      const { sessionId, error, e2e } = payload;
      if (!response.ok || !sessionId) {
        throw new Error(error || 'Failed to create checkout session');
      }

      if (e2e || (typeof sessionId === 'string' && sessionId.startsWith(E2E_CHECKOUT_SESSION_PREFIX))) {
        router.push(`/checkout/success?session_id=${encodeURIComponent(sessionId)}`);
        return;
      }

      const configResponse = await fetch('/api/config/public');
      const publicConfig = await configResponse.json();
      const publishableKey = publicConfig.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
      if (!publishableKey) {
        throw new Error('Stripe publishable key is not configured');
      }

      const stripe = await loadStripe(publishableKey);
      const { error: stripeError } = await stripe!.redirectToCheckout({ sessionId });

      if (stripeError) {
        console.error('Stripe error:', stripeError);
        setSubmitError('Payment could not be started. Please check your details and try again.');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      setSubmitError(error instanceof Error ? error.message : 'Something went wrong. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!state.isLoaded) {
    return (
      <main className="min-h-screen bg-neutral-50 py-12">
        <div className="mx-auto max-w-3xl px-4 text-center text-neutral-600">
          Loading checkout…
        </div>
      </main>
    );
  }

  if (state.items.length === 0) {
    return null;
  }

  const orderSummary = (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="space-y-4 mb-6">
        {state.items.map((item) => {
          const itemKey = getItemKey(item.product.id, item.variant);
          const variantLabel = formatCartItemVariant(item.variant);
          return (
            <div key={itemKey} className="flex gap-4">
              <div className="relative w-16 h-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                <Image
                  src={productImageSrc(item.product)}
                  alt={item.product.title}
                  fill
                  className="object-cover"
                  sizes="64px"
                />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-gray-900 truncate">{item.product.title}</h3>
                <p className="text-sm text-gray-500">{item.product.medium}</p>
                {variantLabel && <p className="text-sm text-gray-500">{variantLabel}</p>}
                <p className="text-sm text-gray-500">Qty: {item.quantity}</p>
              </div>
              <div className="text-right">
                <p className="font-medium text-gray-900">{formatPrice(cartItemLineTotal(item))}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-gray-200 pt-6 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Subtotal</span>
          <span className="text-gray-900">{formatPrice(subtotal)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Shipping</span>
          <span className="text-gray-900">{formatPrice(shipping)}</span>
        </div>
        {formData.promoCode.trim() && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Promo code</span>
            <span className="text-gray-900">Validated at checkout</span>
          </div>
        )}
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Tax</span>
          <span className="text-gray-900">Calculated by Stripe</span>
        </div>
        <div className="border-t border-gray-200 pt-2 flex justify-between font-semibold text-lg">
          <span>Estimated total</span>
          <span>{formatPrice(total)}</span>
        </div>
        <p className="text-xs text-gray-500 pt-1">Final tax is calculated securely at payment when Stripe automatic tax is enabled.</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 py-8 md:py-16">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-8 md:mb-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Checkout</h1>
          <p className="text-gray-600">Complete your purchase securely</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16">
          <div className="order-1 lg:order-none">
            <details className="lg:hidden mb-6 rounded-lg border border-gray-200 bg-white">
              <summary className="cursor-pointer list-none px-4 py-3 font-medium text-gray-900 flex items-center justify-between">
                <span>Order summary</span>
                <span>{formatPrice(total)}</span>
              </summary>
              <div className="px-4 pb-4">{orderSummary}</div>
            </details>

            <div className="hidden lg:block">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Order Summary</h2>
              {orderSummary}
            </div>
          </div>

          <div className="order-2 lg:order-none">
            <div className="mb-6 flex items-center gap-2">
              {CHECKOUT_STEPS.map((entry, index) => {
                const activeIndex = CHECKOUT_STEPS.findIndex((item) => item.id === step);
                const isComplete = index < activeIndex;
                const isCurrent = entry.id === step;
                return (
                  <div key={entry.id} className="flex items-center gap-2 flex-1 min-w-0">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${isCurrent ? 'bg-primary text-white' : isComplete ? 'bg-primary/10 text-primary' : 'bg-gray-200 text-gray-600'}`}>
                      {index + 1}
                    </div>
                    <span className={`text-sm truncate ${isCurrent ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>{entry.label}</span>
                    {index < CHECKOUT_STEPS.length - 1 && <div className="hidden sm:block h-px flex-1 bg-gray-200" />}
                  </div>
                );
              })}
            </div>

            <h2 className="text-xl font-semibold text-gray-900 mb-6">
              {step === 'contact' ? 'Contact Information' : step === 'shipping' ? 'Shipping Information' : 'Review & Pay'}
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              {submitError && (
                <div data-testid="checkout-error" role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                  {submitError}
                </div>
              )}

              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                {step === 'contact' && (
                <>
                <div className="mb-6">
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary ${
                      errors.email ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="john@example.com"
                  />
                  {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
                </div>

                <div>
                  <label htmlFor="promoCode" className="block text-sm font-medium text-gray-700 mb-1">
                    Promo Code
                  </label>
                  <input
                    type="text"
                    id="promoCode"
                    name="promoCode"
                    value={formData.promoCode}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary uppercase"
                    placeholder="Optional"
                    autoComplete="off"
                  />
                  <p className="mt-1 text-xs text-gray-500">Valid codes are applied securely when payment is created.</p>
                </div>
                </>
                )}

                {step === 'shipping' && (
                <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                  <div>
                    <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
                      First Name
                    </label>
                    <input
                      type="text"
                      id="firstName"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary ${
                        errors.firstName ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {errors.firstName && <p className="text-red-500 text-sm mt-1">{errors.firstName}</p>}
                  </div>
                  <div>
                    <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
                      Last Name
                    </label>
                    <input
                      type="text"
                      id="lastName"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary ${
                        errors.lastName ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {errors.lastName && <p className="text-red-500 text-sm mt-1">{errors.lastName}</p>}
                  </div>
                </div>

                {/* Address */}
                <div className="space-y-4">
                  <div>
                    <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">
                      Address
                    </label>
                    <input
                      type="text"
                      id="address"
                      name="address"
                      value={formData.address}
                      onChange={handleInputChange}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary ${
                        errors.address ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {errors.address && <p className="text-red-500 text-sm mt-1">{errors.address}</p>}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-1">
                        City
                      </label>
                      <input
                        type="text"
                        id="city"
                        name="city"
                        value={formData.city}
                        onChange={handleInputChange}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary ${
                          errors.city ? 'border-red-500' : 'border-gray-300'
                        }`}
                      />
                      {errors.city && <p className="text-red-500 text-sm mt-1">{errors.city}</p>}
                    </div>
                    <div>
                      <label htmlFor="state" className="block text-sm font-medium text-gray-700 mb-1">
                        State
                      </label>
                      <input
                        type="text"
                        id="state"
                        name="state"
                        value={formData.state}
                        onChange={handleInputChange}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary ${
                          errors.state ? 'border-red-500' : 'border-gray-300'
                        }`}
                      />
                      {errors.state && <p className="text-red-500 text-sm mt-1">{errors.state}</p>}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="postalCode" className="block text-sm font-medium text-gray-700 mb-1">
                        Postal Code
                      </label>
                      <input
                        type="text"
                        id="postalCode"
                        name="postalCode"
                        value={formData.postalCode}
                        onChange={handleInputChange}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary ${
                          errors.postalCode ? 'border-red-500' : 'border-gray-300'
                        }`}
                      />
                      {errors.postalCode && <p className="text-red-500 text-sm mt-1">{errors.postalCode}</p>}
                    </div>
                    <div>
                      <label htmlFor="country" className="block text-sm font-medium text-gray-700 mb-1">
                        Country
                      </label>
                      <select
                        id="country"
                        name="country"
                        value={formData.country}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                      >
                        <option value="US">United States</option>
                        <option value="CA">Canada</option>
                        <option value="GB">United Kingdom</option>
                        <option value="AU">Australia</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary ${
                        errors.phone ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {errors.phone && <p className="text-red-500 text-sm mt-1">{errors.phone}</p>}
                  </div>
                </div>
                </>
                )}

                {step === 'review' && (
                <div className="space-y-4 text-sm text-gray-700">
                  <div>
                    <p className="font-medium text-gray-900">Contact</p>
                    <p>{formData.email}</p>
                    {formData.promoCode.trim() && <p>Promo: {formData.promoCode.toUpperCase()}</p>}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Ship to</p>
                    <p>{formData.firstName} {formData.lastName}</p>
                    <p>{formData.address}</p>
                    <p>{formData.city}, {formData.state} {formData.postalCode}</p>
                    <p>{formData.country}</p>
                    <p>{formData.phone}</p>
                  </div>
                  <p className="text-gray-600">Payment is processed securely by Stripe on the next step.</p>
                </div>
                )}
              </div>

              <div className="flex flex-col-reverse sm:flex-row gap-3">
                {step !== 'contact' && (
                  <button
                    type="button"
                    onClick={goToPreviousStep}
                    className="w-full sm:w-auto px-6 py-3 rounded-lg border border-gray-300 text-gray-900 hover:bg-gray-50"
                  >
                    Back
                  </button>
                )}
                {step !== 'review' ? (
                  <button
                    type="button"
                    onClick={goToNextStep}
                    className="w-full sm:flex-1 btn-primary py-3 px-6 rounded-lg"
                  >
                    Continue
                  </button>
                ) : (
              <button
                type="submit"
                data-testid="complete-order"
                disabled={isProcessing}
                className="w-full sm:flex-1 btn-primary py-4 px-6 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    Complete Purchase ({formatPrice(total)})
                  </>
                )}
              </button>
                )}
              </div>

              {step === 'review' && (
              <p className="text-sm text-gray-500 text-center">{trustCopy}</p>
              )}
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}