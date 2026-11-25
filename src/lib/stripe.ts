import 'server-only';
import Stripe from 'stripe';
import { getConfig, getConfigBool } from '@/lib/config';

export type CheckoutMode = 'stripe' | 'manual';

export const DEFAULT_MANUAL_PAYMENT_INSTRUCTIONS =
  'No payment is taken here. The studio will confirm availability and reach out with payment options (invoice, Venmo, Zelle, or pickup).';

/**
 * Resolves the active checkout mode:
 * - Explicit `CHECKOUT_MODE` (`stripe` or `manual`) wins.
 * - Otherwise defaults to `stripe` when both Stripe keys are configured, or `manual` so
 *   a new studio can take purchase requests immediately without waiting on Stripe credentials.
 */
export async function resolveCheckoutMode(): Promise<CheckoutMode> {
  const explicit = (await getConfig('CHECKOUT_MODE'))?.trim().toLowerCase();
  if (explicit === 'manual') return 'manual';
  if (explicit === 'stripe') return 'stripe';

  const [secretKey, publishableKey] = await Promise.all([
    getConfig('STRIPE_SECRET_KEY'),
    getConfig('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY'),
  ]);
  return secretKey && publishableKey ? 'stripe' : 'manual';
}

export async function getCheckoutRuntimeConfig(): Promise<{
  checkoutMode: CheckoutMode;
  manualPaymentInstructions: string;
  automaticTaxEnabled: boolean;
}> {
  const [checkoutMode, rawInstructions, automaticTaxEnabled] = await Promise.all([
    resolveCheckoutMode(),
    getConfig('MANUAL_PAYMENT_INSTRUCTIONS'),
    getConfigBool('STRIPE_AUTOMATIC_TAX_ENABLED'),
  ]);

  return {
    checkoutMode,
    manualPaymentInstructions: rawInstructions?.trim() || DEFAULT_MANUAL_PAYMENT_INSTRUCTIONS,
    automaticTaxEnabled,
  };
}

export interface StripeCheckoutCustomerInput {
  email: string;
  firstName: string;
  lastName: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone?: string;
}

export function buildStripeCustomerParams(input: StripeCheckoutCustomerInput): {
  email: string;
  name: string;
  phone?: string;
  address: Stripe.Checkout.SessionCreateParams.PaymentIntentData.Shipping['address'];
  shipping: Stripe.Checkout.SessionCreateParams.PaymentIntentData.Shipping;
} {
  const email = input.email.trim().toLowerCase();
  const name = [input.firstName, input.lastName]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(' ');
  const phone = input.phone?.trim() || undefined;
  const address: Stripe.Checkout.SessionCreateParams.PaymentIntentData.Shipping['address'] = {
    line1: input.address1.trim(),
    ...(input.address2?.trim() ? { line2: input.address2.trim() } : {}),
    city: input.city.trim(),
    state: input.state.trim(),
    postal_code: input.postalCode.trim(),
    country: input.country.trim().toUpperCase(),
  };

  return {
    email,
    name,
    ...(phone ? { phone } : {}),
    address,
    shipping: {
      name: name || email,
      ...(phone ? { phone } : {}),
      address,
    },
  };
}

/**
 * Creates or updates a Stripe Customer from the site's validated checkout details so Stripe
 * Checkout prefills contact/billing details and calculates tax without asking the collector
 * to re-enter their shipping address or phone number a second time.
 */
export async function upsertStripeCheckoutCustomer(
  stripe: Stripe,
  input: StripeCheckoutCustomerInput,
): Promise<{
  customer: Stripe.Customer;
  params: ReturnType<typeof buildStripeCustomerParams>;
}> {
  const params = buildStripeCustomerParams(input);
  const existing = await stripe.customers.list({
    email: params.email,
    limit: 1,
  });

  const existingCustomer = existing.data[0];
  if (existingCustomer) {
    const updated = await stripe.customers.update(existingCustomer.id, {
      name: params.name,
      ...(params.phone ? { phone: params.phone } : {}),
      address: params.address,
      shipping: params.shipping,
    });
    return { customer: updated, params };
  }

  const created = await stripe.customers.create({
    email: params.email,
    name: params.name,
    ...(params.phone ? { phone: params.phone } : {}),
    address: params.address,
    shipping: params.shipping,
  });
  return { customer: created, params };
}

export async function getStripe(): Promise<Stripe> {
  const secretKey = await getConfig('STRIPE_SECRET_KEY');
  if (!secretKey) {
    throw new Error('Stripe is not configured');
  }

  return new Stripe(secretKey, {
    apiVersion: '2025-06-30.basil',
  });
}