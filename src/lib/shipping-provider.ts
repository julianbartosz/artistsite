import 'server-only';
import { ApiError } from '@/lib/api-error-handler';
import { getConfig } from '@/lib/config';
import type { Order, ShippingAddress } from '@/lib/orders';

type ShippingProvider = 'manual' | 'easypost';

export type ShippingLabelResult = {
  provider: ShippingProvider;
  shipmentId: string;
  carrier?: string;
  trackingNumber?: string;
  labelUrl?: string;
  estimatedDelivery?: Date;
};

type EasyPostAddress = {
  name: string;
  company?: string;
  street1: string;
  street2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  phone?: string;
  email?: string;
};

function normalizeProvider(value?: string): ShippingProvider {
  return (value || '').trim().toLowerCase() === 'easypost' ? 'easypost' : 'manual';
}

function required(value: string | undefined, label: string): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new ApiError(
      400,
      `${label} is required before buying shipping labels. Add it under Settings → Shipping.`,
      'SHIPPING_CONFIG_MISSING'
    );
  }
  return trimmed;
}

function numberConfig(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function toEasyPostCountry(country: string | undefined): string {
  return (country || 'US').trim().toUpperCase();
}

function toEasyPostAddress(address: ShippingAddress, email?: string): EasyPostAddress {
  return {
    name: `${address.firstName} ${address.lastName}`.trim(),
    company: address.company,
    street1: address.address1,
    street2: address.address2,
    city: address.city,
    state: address.state,
    zip: address.postalCode,
    country: toEasyPostCountry(address.country),
    phone: address.phone,
    email,
  };
}

async function getFromAddress(): Promise<EasyPostAddress> {
  const [name, company, street1, street2, city, state, zip, country, phone, email] = await Promise.all([
    getConfig('SHIP_FROM_NAME'),
    getConfig('SHIP_FROM_COMPANY'),
    getConfig('SHIP_FROM_STREET1'),
    getConfig('SHIP_FROM_STREET2'),
    getConfig('SHIP_FROM_CITY'),
    getConfig('SHIP_FROM_STATE'),
    getConfig('SHIP_FROM_POSTAL_CODE'),
    getConfig('SHIP_FROM_COUNTRY'),
    getConfig('SHIP_FROM_PHONE'),
    getConfig('ARTIST_EMAIL'),
  ]);

  return {
    name: required(name, 'Ship-from name'),
    company: company || undefined,
    street1: required(street1, 'Ship-from street'),
    street2: street2 || undefined,
    city: required(city, 'Ship-from city'),
    state: required(state, 'Ship-from state'),
    zip: required(zip, 'Ship-from postal code'),
    country: toEasyPostCountry(country),
    phone: phone || undefined,
    email: email || undefined,
  };
}

async function getParcel() {
  const [weight, length, width, height] = await Promise.all([
    getConfig('SHIPPING_DEFAULT_PACKAGE_WEIGHT_OZ'),
    getConfig('SHIPPING_DEFAULT_PACKAGE_LENGTH_IN'),
    getConfig('SHIPPING_DEFAULT_PACKAGE_WIDTH_IN'),
    getConfig('SHIPPING_DEFAULT_PACKAGE_HEIGHT_IN'),
  ]);

  return {
    weight: numberConfig(weight, 48),
    length: numberConfig(length, 30),
    width: numberConfig(width, 24),
    height: numberConfig(height, 4),
  };
}

function easypostAuth(apiKey: string): string {
  return `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`;
}

async function easypostRequest(path: string, apiKey: string, body: unknown) {
  const response = await fetch(`https://api.easypost.com/v2${path}`, {
    method: 'POST',
    headers: {
      'Authorization': easypostAuth(apiKey),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(
      502,
      data?.error?.message || data?.message || 'Shipping provider request failed',
      'SHIPPING_PROVIDER_ERROR'
    );
  }
  return data;
}

function carrierId(value?: string): string | undefined {
  const carrier = value?.trim().toLowerCase();
  if (!carrier) return undefined;
  if (carrier.includes('usps')) return 'usps';
  if (carrier.includes('ups')) return 'ups';
  if (carrier.includes('fedex')) return 'fedex';
  if (carrier.includes('dhl')) return 'dhl';
  return 'other';
}

function parseDeliveryDate(value: unknown): Date | undefined {
  if (typeof value !== 'string') return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

async function buyEasyPostLabel(order: Order): Promise<ShippingLabelResult> {
  const apiKey = required(await getConfig('EASYPOST_API_KEY'), 'EasyPost API key');
  const shipment = await easypostRequest('/shipments', apiKey, {
    shipment: {
      to_address: toEasyPostAddress(order.shippingAddress, order.customerEmail),
      from_address: await getFromAddress(),
      parcel: await getParcel(),
      options: { label_format: 'PDF' },
    },
  });
  const rate = shipment.lowest_rate || shipment.rates?.[0];
  if (!rate?.id) throw new ApiError(422, 'No shipping rates were returned for this order', 'SHIPPING_NO_RATES');

  const bought = await easypostRequest(`/shipments/${shipment.id}/buy`, apiKey, { rate: { id: rate.id } });
  return {
    provider: 'easypost',
    shipmentId: String(bought.id || shipment.id),
    carrier: carrierId(bought.selected_rate?.carrier || rate.carrier),
    trackingNumber: bought.tracking_code ? String(bought.tracking_code) : undefined,
    labelUrl: bought.postage_label?.label_url ? String(bought.postage_label.label_url) : undefined,
    estimatedDelivery: parseDeliveryDate(bought.selected_rate?.delivery_date || rate.delivery_date),
  };
}

export async function buyShippingLabel(order: Order): Promise<ShippingLabelResult> {
  const provider = normalizeProvider(await getConfig('SHIPPING_PROVIDER'));
  if (provider !== 'easypost') {
    throw new ApiError(
      400,
      'In-site label purchase requires the EasyPost provider. Set Shipping provider to easypost under Settings → Shipping, or enter carrier and tracking manually.',
      'SHIPPING_PROVIDER_DISABLED'
    );
  }
  return buyEasyPostLabel(order);
}