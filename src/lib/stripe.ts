import 'server-only';
import Stripe from 'stripe';
import { getConfig } from '@/lib/config';

export async function getStripe(): Promise<Stripe> {
  const secretKey = await getConfig('STRIPE_SECRET_KEY');
  if (!secretKey) {
    throw new Error('Stripe is not configured');
  }

  return new Stripe(secretKey, {
    apiVersion: '2025-06-30.basil',
  });
}