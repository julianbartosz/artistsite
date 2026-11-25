import type { ShippingAddress } from '@/lib/shipping-address';

export type ShippingCarrierId = 'usps' | 'ups' | 'fedex' | 'dhl' | 'canada_post' | 'other';

export const SHIPPING_CARRIERS: Array<{ id: ShippingCarrierId; label: string; urlTemplate?: string }> = [
  { id: 'usps', label: 'USPS', urlTemplate: 'https://tools.usps.com/go/TrackConfirmAction?tLabels={tracking}' },
  { id: 'ups', label: 'UPS', urlTemplate: 'https://www.ups.com/track?tracknum={tracking}' },
  { id: 'fedex', label: 'FedEx', urlTemplate: 'https://www.fedex.com/fedextrack/?trknbr={tracking}' },
  { id: 'dhl', label: 'DHL', urlTemplate: 'https://www.dhl.com/global-en/home/tracking/tracking-express.html?submit=1&tracking-id={tracking}' },
  { id: 'canada_post', label: 'Canada Post', urlTemplate: 'https://www.canadapost-postescanada.ca/track-reperage/en#/search?searchFor={tracking}' },
  { id: 'other', label: 'Other carrier' },
];

export type ParcelDimensions = {
  weightOz: number;
  lengthIn: number;
  widthIn: number;
  heightIn: number;
};

export type OptionalParcelDimensions = Partial<ParcelDimensions>;

export type ShippingPreset = {
  id: string;
  label: string;
  hint: string;
  domestic: number;
  international: number;
  parcel: ParcelDimensions;
};

export const DEFAULT_STUDIO_PARCEL: ParcelDimensions = {
  weightOz: 24,
  lengthIn: 16,
  widthIn: 12,
  heightIn: 3,
};

/** Studio-oriented starting presets shared by the Product Editor and Order EasyPost label panel. */
export const STUDIO_SHIPPING_PRESETS: readonly ShippingPreset[] = [
  {
    id: 'small-print',
    label: 'Small print / postcard',
    hint: '9×6×1 in · 6 oz',
    domestic: 5,
    international: 14,
    parcel: { weightOz: 6, lengthIn: 9, widthIn: 6, heightIn: 1 },
  },
  {
    id: 'rigid-mailer',
    label: 'Print in rigid mailer',
    hint: '16×12×2 in · 16 oz',
    domestic: 12,
    international: 28,
    parcel: { weightOz: 16, lengthIn: 16, widthIn: 12, heightIn: 2 },
  },
  {
    id: 'print-tube',
    label: 'Rolled print in tube',
    hint: '26×4×4 in · 18 oz',
    domestic: 14,
    international: 32,
    parcel: { weightOz: 18, lengthIn: 26, widthIn: 4, heightIn: 4 },
  },
  {
    id: 'medium-canvas',
    label: 'Medium canvas / flat art',
    hint: '24×18×4 in · 48 oz',
    domestic: 25,
    international: 65,
    parcel: { weightOz: 48, lengthIn: 24, widthIn: 18, heightIn: 4 },
  },
  {
    id: 'large-framed',
    label: 'Large framed piece',
    hint: '36×28×6 in · 112 oz',
    domestic: 55,
    international: 120,
    parcel: { weightOz: 112, lengthIn: 36, widthIn: 28, heightIn: 6 },
  },
];

export function shippingCarrierLabel(carrier?: string | null): string | undefined {
  if (!carrier) return undefined;
  return SHIPPING_CARRIERS.find((candidate) => candidate.id === carrier)?.label || carrier;
}

export function trackingUrl(carrier?: string | null, trackingNumber?: string | null): string | undefined {
  const tracking = trackingNumber?.trim();
  if (!tracking) return undefined;

  const carrierConfig = SHIPPING_CARRIERS.find((candidate) => candidate.id === carrier);
  if (!carrierConfig?.urlTemplate) return undefined;

  return carrierConfig.urlTemplate.replace('{tracking}', encodeURIComponent(tracking));
}

function isAllDigits(value: string): boolean {
  if (!value) return false;
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code < 48 || code > 57) return false;
  }
  return true;
}

function isAlphaNumeric(value: string): boolean {
  if (!value) return false;
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    const isNum = code >= 48 && code <= 57;
    const isUpper = code >= 65 && code <= 90;
    const isLower = code >= 97 && code <= 122;
    if (!isNum && !isUpper && !isLower) return false;
  }
  return true;
}

function stripTrackingWhitespace(value: string): string {
  let out = '';
  for (let i = 0; i < value.length; i += 1) {
    const ch = value[i];
    if (ch !== ' ' && ch !== '\t' && ch !== '\n' && ch !== '\r' && ch !== '-') {
      out += ch;
    }
  }
  return out;
}

function detectCarrierFromCode(code: string): ShippingCarrierId | undefined {
  const cleaned = stripTrackingWhitespace(code).toUpperCase();
  if (!cleaned) return undefined;

  // UPS standard 1Z + 16 alphanumeric characters
  if (cleaned.startsWith('1Z') && cleaned.length === 18 && isAlphaNumeric(cleaned)) {
    return 'ups';
  }
  // DHL eCommerce / piece ID (JD + 16-20 digits)
  if (cleaned.startsWith('JD') && cleaned.length >= 18 && cleaned.length <= 22 && isAllDigits(cleaned.slice(2))) {
    return 'dhl';
  }
  // UPU S10 international tracking (2 letters + 9 digits + 2 country letters)
  if (
    cleaned.length === 13
    && isAlphaNumeric(cleaned)
    && isAllDigits(cleaned.slice(2, 11))
  ) {
    if (cleaned.endsWith('US')) return 'usps';
    if (cleaned.endsWith('CA')) return 'canada_post';
  }
  if (isAllDigits(cleaned)) {
    // USPS Intelligent Mail Package Barcode (20-22 digits starting with 92/93/94/95, or 26/30 digits)
    if (
      (cleaned.length >= 20 && cleaned.length <= 22 && ['92', '93', '94', '95'].includes(cleaned.slice(0, 2)))
      || (cleaned.length === 26 && cleaned.startsWith('420'))
    ) {
      return 'usps';
    }
    // FedEx common lengths: 12, 15, or 20 digits (not starting with USPS 92-95)
    if (cleaned.length === 12 || cleaned.length === 15 || cleaned.length === 20) {
      return 'fedex';
    }
    // DHL Express 10-digit waybill
    if (cleaned.length === 10) {
      return 'dhl';
    }
  }
  return undefined;
}

/**
 * Extracts a clean tracking number and inferred carrier when an artist pastes
 * either a carrier tracking URL or a raw tracking number.
 */
export function parseTrackingInput(raw: string): {
  trackingNumber: string;
  carrier?: ShippingCarrierId;
  cleanedFromUrl: boolean;
} {
  const trimmed = raw.trim();
  if (!trimmed) return { trackingNumber: '', cleanedFromUrl: false };

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const parsed = new URL(trimmed);
      const host = parsed.hostname.toLowerCase();
      const firstParam = (...names: string[]) => {
        for (const name of names) {
          const val = parsed.searchParams.get(name)?.trim();
          if (val) return val;
        }
        return '';
      };

      let carrier: ShippingCarrierId | undefined;
      let extracted = '';
      if (host.includes('usps.com')) {
        carrier = 'usps';
        extracted = firstParam('tLabels', 'qtc_tLabels1', 'origTrackNum');
      } else if (host.includes('ups.com')) {
        carrier = 'ups';
        extracted = firstParam('tracknum', 'trackingNumber', 'trackNums');
      } else if (host.includes('fedex.com')) {
        carrier = 'fedex';
        extracted = firstParam('trknbr', 'trackingnumber', 'tracknumbers');
      } else if (host.includes('dhl.com')) {
        carrier = 'dhl';
        extracted = firstParam('tracking-id', 'AWB', 'trackingNumber');
      } else if (host.includes('canadapost')) {
        carrier = 'canada_post';
        extracted = firstParam('searchFor', 'trackingNumber');
        if (!extracted && parsed.hash.includes('searchFor=')) {
          const hashQuery = parsed.hash.slice(parsed.hash.indexOf('?') + 1);
          extracted = new URLSearchParams(hashQuery).get('searchFor')?.trim() || '';
        }
      }

      if (extracted) {
        const cleanCode = stripTrackingWhitespace(extracted);
        return {
          trackingNumber: cleanCode,
          carrier: carrier ?? detectCarrierFromCode(cleanCode),
          cleanedFromUrl: true,
        };
      }
    } catch {
      // Fall through to raw tracking detection.
    }
  }

  const detected = detectCarrierFromCode(trimmed);
  const trackingNumber = detected ? stripTrackingWhitespace(trimmed) : trimmed;
  return {
    trackingNumber,
    ...(detected ? { carrier: detected } : {}),
    cleanedFromUrl: false,
  };
}

export function formatShippingAddressLines(address: ShippingAddress | null | undefined): string[] {
  if (!address) return [];
  const fullName = [address.firstName, address.lastName].map((part) => part?.trim()).filter(Boolean).join(' ');
  const cityState = [address.city?.trim(), address.state?.trim()].filter(Boolean).join(', ');
  const cityStateZip = [cityState, address.postalCode?.trim()].filter(Boolean).join(' ');
  const country = address.country?.trim().toUpperCase();
  return [
    fullName,
    address.company?.trim() || '',
    address.address1?.trim() || '',
    address.address2?.trim() || '',
    cityStateZip,
    country && country !== 'US' ? country : '',
  ].filter(Boolean);
}

export function formatShippingAddressBlock(address: ShippingAddress | null | undefined): string {
  return formatShippingAddressLines(address).join('\n');
}

function positiveNum(value: unknown): number | undefined {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : undefined;
}

/**
 * Resolves package weight & dimensions for an order from item-level product parcel
 * settings, stacking heights and summing weights, with Studio defaults as fallback.
 */
export function inferOrderParcel(
  items: Array<{ quantity: number; product?: { shipping?: { parcel?: OptionalParcelDimensions } } }>,
  fallback: ParcelDimensions = DEFAULT_STUDIO_PARCEL,
): ParcelDimensions {
  let totalWeight = 0;
  let maxLength = 0;
  let maxWidth = 0;
  let totalHeight = 0;
  let hasWeight = false;
  let hasLength = false;
  let hasWidth = false;
  let hasHeight = false;

  for (const item of items) {
    const qty = Math.max(1, Math.floor(Number(item.quantity) || 1));
    const parcel = item.product?.shipping?.parcel;
    if (!parcel) continue;
    const weight = positiveNum(parcel.weightOz);
    const length = positiveNum(parcel.lengthIn);
    const width = positiveNum(parcel.widthIn);
    const height = positiveNum(parcel.heightIn);
    if (weight) {
      totalWeight += weight * qty;
      hasWeight = true;
    }
    if (length) {
      maxLength = Math.max(maxLength, length);
      hasLength = true;
    }
    if (width) {
      maxWidth = Math.max(maxWidth, width);
      hasWidth = true;
    }
    if (height) {
      totalHeight += height * qty;
      hasHeight = true;
    }
  }

  return {
    weightOz: hasWeight ? Math.round(totalWeight * 10) / 10 : fallback.weightOz,
    lengthIn: hasLength ? Math.round(maxLength * 10) / 10 : fallback.lengthIn,
    widthIn: hasWidth ? Math.round(maxWidth * 10) / 10 : fallback.widthIn,
    heightIn: hasHeight ? Math.round(totalHeight * 10) / 10 : fallback.heightIn,
  };
}