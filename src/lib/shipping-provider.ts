import 'server-only';
import { ApiError } from '@/lib/api-error-handler';
import { getConfig } from '@/lib/config';
import { getEmailBrand, getEmailDeliveryStatus } from '@/lib/email';
import type { Order, ShippingAddress } from '@/lib/orders';
import { inferOrderParcel, type OptionalParcelDimensions, type ParcelDimensions, type ShippingCarrierId } from '@/lib/shipping';

export type ShippingProvider = 'manual' | 'easypost';

export type ShippingFulfillmentContext = {
  provider: ShippingProvider;
  easyPostReady: boolean;
  missingConfig: string[];
  defaultParcel: ParcelDimensions;
  studioName: string;
  studioUrl: string;
  supportEmail: string;
  studioReturnAddress: ShippingAddress | null;
  emailDeliveryMode: 'smtp' | 'log' | 'unconfigured';
};

export type ShippingRateOption = {
  id: string;
  carrier: string;
  carrierId: ShippingCarrierId;
  service: string;
  rate: number;
  currency: string;
  deliveryDays?: number;
  deliveryDate?: string;
};

export type ShippingRateQuote = {
  shipmentId: string;
  parcel: ParcelDimensions;
  rates: ShippingRateOption[];
};

export type ShippingLabelResult = {
  provider: ShippingProvider;
  shipmentId: string;
  carrier?: string;
  service?: string;
  rate?: number;
  currency?: string;
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

async function getDefaultParcel(): Promise<ParcelDimensions> {
  const [weight, length, width, height] = await Promise.all([
    getConfig('SHIPPING_DEFAULT_PACKAGE_WEIGHT_OZ'),
    getConfig('SHIPPING_DEFAULT_PACKAGE_LENGTH_IN'),
    getConfig('SHIPPING_DEFAULT_PACKAGE_WIDTH_IN'),
    getConfig('SHIPPING_DEFAULT_PACKAGE_HEIGHT_IN'),
  ]);

  return {
    weightOz: numberConfig(weight, 48),
    lengthIn: numberConfig(length, 30),
    widthIn: numberConfig(width, 24),
    heightIn: numberConfig(height, 4),
  };
}

function resolveParcelOverride(base: ParcelDimensions, override?: OptionalParcelDimensions): ParcelDimensions {
  if (!override) return base;
  const pick = (candidate: unknown, fallback: number) => {
    const parsed = Number(candidate);
    return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 10) / 10 : fallback;
  };
  return {
    weightOz: pick(override.weightOz, base.weightOz),
    lengthIn: pick(override.lengthIn, base.lengthIn),
    widthIn: pick(override.widthIn, base.widthIn),
    heightIn: pick(override.heightIn, base.heightIn),
  };
}

export async function getShippingFulfillmentContext(): Promise<ShippingFulfillmentContext> {
  const [
    providerRaw,
    apiKey,
    shipFromName,
    shipFromCompany,
    shipFromStreet1,
    shipFromStreet2,
    shipFromCity,
    shipFromState,
    shipFromZip,
    shipFromCountry,
    shipFromPhone,
    defaultParcel,
    brand,
    emailDelivery,
    supportEmail,
    contactEmail,
  ] = await Promise.all([
    getConfig('SHIPPING_PROVIDER'),
    getConfig('EASYPOST_API_KEY'),
    getConfig('SHIP_FROM_NAME'),
    getConfig('SHIP_FROM_COMPANY'),
    getConfig('SHIP_FROM_STREET1'),
    getConfig('SHIP_FROM_STREET2'),
    getConfig('SHIP_FROM_CITY'),
    getConfig('SHIP_FROM_STATE'),
    getConfig('SHIP_FROM_POSTAL_CODE'),
    getConfig('SHIP_FROM_COUNTRY'),
    getConfig('SHIP_FROM_PHONE'),
    getDefaultParcel(),
    getEmailBrand(),
    getEmailDeliveryStatus(),
    getConfig('SUPPORT_EMAIL'),
    getConfig('CONTACT_EMAIL'),
  ]);

  const provider = normalizeProvider(providerRaw);
  const missingConfig: string[] = [];
  if (provider === 'easypost') {
    if (!apiKey?.trim()) missingConfig.push('EasyPost API key');
    if (!shipFromName?.trim()) missingConfig.push('Ship-from name');
    if (!shipFromStreet1?.trim()) missingConfig.push('Ship-from street');
    if (!shipFromCity?.trim()) missingConfig.push('Ship-from city');
    if (!shipFromState?.trim()) missingConfig.push('Ship-from state');
    if (!shipFromZip?.trim()) missingConfig.push('Ship-from postal code');
  }

  const hasReturnAddress = Boolean(shipFromStreet1?.trim() && shipFromCity?.trim());
  const studioReturnAddress: ShippingAddress | null = hasReturnAddress
    ? {
        firstName: (shipFromName || brand.siteName || '').trim(),
        lastName: '',
        company: shipFromCompany?.trim() || undefined,
        address1: shipFromStreet1!.trim(),
        address2: shipFromStreet2?.trim() || undefined,
        city: shipFromCity!.trim(),
        state: (shipFromState || '').trim(),
        postalCode: (shipFromZip || '').trim(),
        country: toEasyPostCountry(shipFromCountry),
        phone: shipFromPhone?.trim() || undefined,
      }
    : null;

  return {
    provider,
    easyPostReady: provider === 'easypost' && missingConfig.length === 0,
    missingConfig,
    defaultParcel,
    studioName: brand.siteName,
    studioUrl: brand.siteUrl,
    supportEmail: (supportEmail || contactEmail || '').trim(),
    studioReturnAddress,
    emailDeliveryMode: emailDelivery.mode,
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

function carrierId(value?: string): ShippingCarrierId {
  const carrier = value?.trim().toLowerCase();
  if (!carrier) return 'other';
  if (carrier.includes('usps')) return 'usps';
  if (carrier.includes('ups')) return 'ups';
  if (carrier.includes('fedex')) return 'fedex';
  if (carrier.includes('dhl')) return 'dhl';
  if (carrier.includes('canada')) return 'canada_post';
  return 'other';
}

function parseDeliveryDate(value: unknown): Date | undefined {
  if (typeof value !== 'string') return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function parseRateOption(raw: any): ShippingRateOption | null {
  if (!raw || typeof raw !== 'object' || !raw.id) return null;
  const amount = Number(raw.rate);
  if (!Number.isFinite(amount) || amount < 0) return null;
  const carrier = typeof raw.carrier === 'string' && raw.carrier.trim() ? raw.carrier.trim() : 'Carrier';
  const service = typeof raw.service === 'string' && raw.service.trim() ? raw.service.trim() : 'Standard';
  const deliveryDays = Number(raw.delivery_days);
  const deliveryDate = typeof raw.delivery_date === 'string' && !Number.isNaN(Date.parse(raw.delivery_date))
    ? raw.delivery_date
    : undefined;
  return {
    id: String(raw.id),
    carrier,
    carrierId: carrierId(carrier),
    service,
    rate: Math.round(amount * 100) / 100,
    currency: typeof raw.currency === 'string' && raw.currency.trim() ? raw.currency.trim().toUpperCase() : 'USD',
    ...(Number.isFinite(deliveryDays) && deliveryDays > 0 ? { deliveryDays: Math.floor(deliveryDays) } : {}),
    ...(deliveryDate ? { deliveryDate } : {}),
  };
}

function ensureEasyPostEnabled(provider: ShippingProvider) {
  if (provider !== 'easypost') {
    throw new ApiError(
      400,
      'In-site label purchase requires the EasyPost provider. Set Shipping provider to EasyPost under Settings → Shipping, or enter carrier and tracking manually.',
      'SHIPPING_PROVIDER_DISABLED'
    );
  }
}

export async function quoteShippingRates(
  order: Order,
  parcelOverride?: OptionalParcelDimensions,
): Promise<ShippingRateQuote> {
  const provider = normalizeProvider(await getConfig('SHIPPING_PROVIDER'));
  ensureEasyPostEnabled(provider);
  const apiKey = required(await getConfig('EASYPOST_API_KEY'), 'EasyPost API key');
  const defaultParcel = await getDefaultParcel();
  const parcel = resolveParcelOverride(inferOrderParcel(order.items, defaultParcel), parcelOverride);

  const shipment = await easypostRequest('/shipments', apiKey, {
    shipment: {
      to_address: toEasyPostAddress(order.shippingAddress, order.customerEmail),
      from_address: await getFromAddress(),
      parcel: {
        weight: parcel.weightOz,
        length: parcel.lengthIn,
        width: parcel.widthIn,
        height: parcel.heightIn,
      },
      options: { label_format: 'PDF' },
    },
  });

  const rates = (Array.isArray(shipment.rates) ? shipment.rates : [])
    .map(parseRateOption)
    .filter((entry: ShippingRateOption | null): entry is ShippingRateOption => entry !== null)
    .sort((a: ShippingRateOption, b: ShippingRateOption) => a.rate - b.rate);

  if (rates.length === 0) {
    throw new ApiError(422, 'No shipping rates were returned for this order and package size.', 'SHIPPING_NO_RATES');
  }

  return {
    shipmentId: String(shipment.id),
    parcel,
    rates,
  };
}

function isSafeEasyPostId(value: string): boolean {
  if (!value || value.length > 128) return false;
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    const ok = (code >= 48 && code <= 57) || (code >= 65 && code <= 90) || (code >= 97 && code <= 122) || code === 95 || code === 45;
    if (!ok) return false;
  }
  return true;
}

export async function buyShippingLabel(
  order: Order,
  options?: { shipmentId?: string; rateId?: string; parcel?: OptionalParcelDimensions },
): Promise<ShippingLabelResult> {
  const provider = normalizeProvider(await getConfig('SHIPPING_PROVIDER'));
  ensureEasyPostEnabled(provider);
  const apiKey = required(await getConfig('EASYPOST_API_KEY'), 'EasyPost API key');

  let shipmentId = options?.shipmentId?.trim();
  let rateId = options?.rateId?.trim();

  if (shipmentId && rateId) {
    if (!isSafeEasyPostId(shipmentId) || !isSafeEasyPostId(rateId)) {
      throw new ApiError(400, 'Invalid EasyPost shipment or rate identifier.', 'INVALID_SHIPMENT_ID');
    }
  } else {
    const quote = await quoteShippingRates(order, options?.parcel);
    shipmentId = quote.shipmentId;
    rateId = quote.rates[0].id;
  }

  const bought = await easypostRequest(`/shipments/${encodeURIComponent(shipmentId)}/buy`, apiKey, {
    rate: { id: rateId },
  });
  const selected = bought.selected_rate;
  const parsedRate = Number(selected?.rate);

  return {
    provider: 'easypost',
    shipmentId: String(bought.id || shipmentId),
    carrier: carrierId(selected?.carrier),
    service: typeof selected?.service === 'string' ? selected.service : undefined,
    rate: Number.isFinite(parsedRate) ? Math.round(parsedRate * 100) / 100 : undefined,
    currency: typeof selected?.currency === 'string' ? selected.currency.toUpperCase() : 'USD',
    trackingNumber: bought.tracking_code ? String(bought.tracking_code) : undefined,
    labelUrl: bought.postage_label?.label_url ? String(bought.postage_label.label_url) : undefined,
    estimatedDelivery: parseDeliveryDate(selected?.delivery_date),
  };
}