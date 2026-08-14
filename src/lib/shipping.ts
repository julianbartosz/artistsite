export type ShippingCarrierId = 'usps' | 'ups' | 'fedex' | 'dhl' | 'canada_post' | 'other';

export const SHIPPING_CARRIERS: Array<{ id: ShippingCarrierId; label: string; urlTemplate?: string }> = [
  { id: 'usps', label: 'USPS', urlTemplate: 'https://tools.usps.com/go/TrackConfirmAction?tLabels={tracking}' },
  { id: 'ups', label: 'UPS', urlTemplate: 'https://www.ups.com/track?tracknum={tracking}' },
  { id: 'fedex', label: 'FedEx', urlTemplate: 'https://www.fedex.com/fedextrack/?trknbr={tracking}' },
  { id: 'dhl', label: 'DHL', urlTemplate: 'https://www.dhl.com/global-en/home/tracking/tracking-express.html?submit=1&tracking-id={tracking}' },
  { id: 'canada_post', label: 'Canada Post', urlTemplate: 'https://www.canadapost-postescanada.ca/track-reperage/en#/search?searchFor={tracking}' },
  { id: 'other', label: 'Other carrier' },
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