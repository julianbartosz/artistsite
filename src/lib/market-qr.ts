export const MARKET_QR_DESTINATIONS = [
  { key: 'home', label: 'Home', path: '/', prompt: 'Scan to visit the site' },
  { key: 'shop', label: 'Shop', path: '/shop', prompt: 'Scan to browse the shop' },
  { key: 'subscribe', label: 'Newsletter signup', path: '/subscribe', prompt: 'Scan to join the mailing list' },
  { key: 'portfolio', label: 'Portfolio', path: '/portfolio', prompt: 'Scan to explore the portfolio' },
  { key: 'contact', label: 'Contact', path: '/contact', prompt: 'Scan to get in touch' },
  { key: 'custom', label: 'Custom page…', path: '/', prompt: 'Scan to open page' },
] as const;

export type MarketQrDestination = (typeof MARKET_QR_DESTINATIONS)[number]['key'];

export const MARKET_PAYMENT_METHODS = [
  { key: 'cash', label: 'Cash' },
  { key: 'venmo', label: 'Venmo' },
  { key: 'zelle', label: 'Zelle' },
  { key: 'card_external', label: 'Card (Reader)' },
  { key: 'stripe_market', label: 'Pay QR (Stripe)' },
] as const;

export type MarketPaymentMethod = (typeof MARKET_PAYMENT_METHODS)[number]['key'];

export function marketPaymentMethodLabel(method?: string | null): string {
  const found = MARKET_PAYMENT_METHODS.find((m) => m.key === method);
  if (found) return found.label;
  if (!method) return 'Other';
  return method.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

const DESTINATION_BY_KEY = new Map<MarketQrDestination, (typeof MARKET_QR_DESTINATIONS)[number]>(
  MARKET_QR_DESTINATIONS.map((entry) => [entry.key, entry]),
);

const DEFAULT_CAMPAIGN_SLUG = 'market';
const MAX_CAMPAIGN_SLUG_LENGTH = 48;

/** Returns true when an origin points to a local/non-public host that phones cannot open at a market. */
export function isLocalOrigin(origin: string): boolean {
  try {
    const hostname = new URL(origin).hostname.toLowerCase().replace(/^\[|\]$/g, '');
    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname === '::1' ||
      hostname.endsWith('.local')
    );
  } catch {
    return true;
  }
}

/** Convert an optional event/market label into a safe UTM campaign slug. */
export function slugifyMarketCampaign(label?: string | null): string {
  const normalized = (label ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_CAMPAIGN_SLUG_LENGTH)
    .replace(/-+$/g, '');

  return normalized || DEFAULT_CAMPAIGN_SLUG;
}

/**
 * Normalize a custom page path (or same-origin full URL) into a safe site-relative path + non-UTM query.
 * Rejects external origins and unsafe schemes so QR links stay strictly on the artist's domain.
 */
export function normalizeMarketQrPath(
  rawPath: string | null | undefined,
  siteOrigin: string,
): string {
  const base = new URL(siteOrigin.trim());
  const trimmed = (rawPath ?? '').trim();
  if (!trimmed) return '/';

  if (trimmed.startsWith('//')) {
    throw new Error('Custom page must be a path on your site, such as /shop/item-name.');
  }

  let parsed: URL;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    parsed = new URL(trimmed);
    if (parsed.origin !== base.origin) {
      throw new Error(`Custom page must stay on ${base.host} (for example /shop/item-name).`);
    }
  } else {
    const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    parsed = new URL(withLeadingSlash, base.origin);
    if (parsed.origin !== base.origin) {
      throw new Error('Custom page must be a path on your site, such as /shop/item-name.');
    }
  }

  // Strip any pre-existing UTM parameters so buildMarketQrUrl owns attribution cleanly.
  const keptParams = new URLSearchParams();
  parsed.searchParams.forEach((value, key) => {
    if (!key.toLowerCase().startsWith('utm_')) {
      keptParams.append(key, value);
    }
  });
  const query = keptParams.toString();
  return `${parsed.pathname}${query ? `?${query}` : ''}`;
}

/**
 * Build the absolute destination URL encoded in a market QR code.
 * Always appends market UTM parameters so analytics can attribute scans.
 */
export function buildMarketQrUrl(
  siteOrigin: string,
  destination: MarketQrDestination = 'home',
  label?: string | null,
  customPath?: string | null,
): string {
  const base = new URL(siteOrigin.trim());
  const resolvedPath =
    destination === 'custom'
      ? normalizeMarketQrPath(customPath, base.origin)
      : (DESTINATION_BY_KEY.get(destination)?.path ?? '/');
  const target = new URL(resolvedPath, base.origin);
  target.searchParams.set('utm_source', 'market');
  target.searchParams.set('utm_medium', 'qr');
  target.searchParams.set('utm_campaign', slugifyMarketCampaign(label));
  return target.toString();
}

export interface MarketPayLineSpec {
  productId: string;
  quantity: number;
}

/** Build an express "Pay at Market" pickup checkout URL for one or more SKUs. */
export function buildMarketPayUrl(
  siteOrigin: string,
  items: MarketPayLineSpec[],
  options?: { eventSlug?: string | null; promoCode?: string | null },
): string {
  const base = new URL(siteOrigin.trim());
  const target = new URL('/checkout', base.origin);
  target.searchParams.set('mode', 'market');

  const cleanItems = items
    .map((item) => ({
      productId: item.productId.trim(),
      quantity: Math.max(1, Math.min(99, Math.floor(Number(item.quantity) || 1))),
    }))
    .filter((item) => item.productId.length > 0);

  if (cleanItems.length === 1) {
    target.searchParams.set('sku', cleanItems[0].productId);
    if (cleanItems[0].quantity > 1) {
      target.searchParams.set('qty', String(cleanItems[0].quantity));
    }
  } else if (cleanItems.length > 1) {
    target.searchParams.set(
      'items',
      cleanItems.map((item) => `${encodeURIComponent(item.productId)}:${item.quantity}`).join(','),
    );
  }

  const eventSlug = options?.eventSlug ? slugifyMarketCampaign(options.eventSlug) : '';
  if (eventSlug) {
    target.searchParams.set('event', eventSlug);
    target.searchParams.set('utm_source', 'market');
    target.searchParams.set('utm_medium', 'pay_qr');
    target.searchParams.set('utm_campaign', eventSlug);
  }
  const promo = options?.promoCode?.trim().toUpperCase();
  if (promo) {
    target.searchParams.set('promo', promo);
  }
  return target.toString();
}

/** Parse express market pay URL search params (`sku` + `qty` OR `items=id:qty,...`) safely. */
export function parseMarketPayParams(searchParams: {
  get(name: string): string | null;
}): { isMarketMode: boolean; items: MarketPayLineSpec[]; eventSlug: string; promoCode: string } {
  const isMarketMode = searchParams.get('mode') === 'market';
  const items: MarketPayLineSpec[] = [];

  const itemsParam = searchParams.get('items');
  if (itemsParam) {
    for (const part of itemsParam.split(',')) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      const lastColon = trimmed.lastIndexOf(':');
      const rawId = lastColon > 0 ? trimmed.slice(0, lastColon) : trimmed;
      const rawQty = lastColon > 0 ? trimmed.slice(lastColon + 1) : '1';
      let productId = rawId;
      try {
        productId = decodeURIComponent(rawId).trim();
      } catch {
        productId = rawId.trim();
      }
      const quantity = Math.max(1, Math.min(99, Math.floor(Number(rawQty) || 1)));
      if (productId) {
        const existing = items.find((entry) => entry.productId === productId);
        if (existing) existing.quantity = Math.min(99, existing.quantity + quantity);
        else items.push({ productId, quantity });
      }
    }
  } else {
    const sku = searchParams.get('sku')?.trim();
    if (sku) {
      const quantity = Math.max(1, Math.min(99, Math.floor(Number(searchParams.get('qty')) || 1)));
      items.push({ productId: sku, quantity });
    }
  }

  const rawEvent = searchParams.get('event') || searchParams.get('utm_campaign') || '';
  const eventSlug = rawEvent.trim() ? slugifyMarketCampaign(rawEvent) : '';
  const promoCode = (searchParams.get('promo') || '').trim().toUpperCase();

  return { isMarketMode, items, eventSlug, promoCode };
}

/** Build a Booth Kiosk newsletter signup URL tagged to an event. */
export function buildMarketKioskUrl(siteOrigin: string, eventSlug?: string | null, eventName?: string | null): string {
  const base = new URL(siteOrigin.trim());
  const target = new URL('/subscribe', base.origin);
  target.searchParams.set('kiosk', '1');
  if (eventSlug?.trim()) {
    const slug = slugifyMarketCampaign(eventSlug);
    target.searchParams.set('event', slug);
    target.searchParams.set('utm_source', 'market');
    target.searchParams.set('utm_medium', 'kiosk');
    target.searchParams.set('utm_campaign', slug);
  }
  if (eventName?.trim()) {
    target.searchParams.set('eventName', eventName.trim().slice(0, 80));
  }
  return target.toString();
}

/** Format a clean human-readable URL (no protocol or UTM clutter) for booth signage & previews. */
export function formatMarketQrDisplayUrl(targetUrl: string): string {
  try {
    const parsed = new URL(targetUrl);
    const cleanPath = parsed.pathname === '/' ? '' : parsed.pathname.replace(/\/+$/, '');
    return `${parsed.host}${cleanPath}`;
  } catch {
    return targetUrl;
  }
}

/** Build a clean PNG or SVG filename for downloading a printable market QR code. */
export function buildMarketQrFilename(
  destination: MarketQrDestination = 'home',
  label?: string | null,
  extension: 'png' | 'svg' = 'png',
  customPath?: string | null,
): string {
  const slug = slugifyMarketCampaign(label);
  let suffix = '';
  if (destination === 'custom') {
    const rawSegment = (customPath ?? '')
      .trim()
      .split(/[?#]/)[0]
      .split('/')
      .filter(Boolean)
      .pop();
    const customSlug = rawSegment ? slugifyMarketCampaign(rawSegment) : '';
    suffix = customSlug && customSlug !== DEFAULT_CAMPAIGN_SLUG ? `-${customSlug}` : '-page';
  } else if (destination !== 'home') {
    suffix = `-${destination}`;
  }
  return `qr-${slug}${suffix}.${extension}`;
}

export function getMarketQrPrompt(destination: MarketQrDestination): string {
  return DESTINATION_BY_KEY.get(destination)?.prompt ?? 'Scan to visit the site';
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function assertSvgMarkup(svgMarkup: string): string {
  const trimmedSvg = svgMarkup.trim();
  if (!trimmedSvg.startsWith('<svg') || !trimmedSvg.endsWith('</svg>')) {
    throw new Error('Invalid QR SVG markup.');
  }
  return trimmedSvg;
}

/** Generate a minimal, gallery-grade printable sign HTML document with an inline vector QR code. */
export function buildPrintableQrSignHtml(options: {
  svgMarkup: string;
  headline: string;
  displayUrl: string;
  eventLabel?: string | null;
}): string {
  const trimmedSvg = assertSvgMarkup(options.svgMarkup);
  const safeHeadline = escapeHtml(options.headline.trim() || 'Scan to visit');
  const safeUrl = escapeHtml(options.displayUrl.trim());
  const safeEvent = options.eventLabel?.trim() ? escapeHtml(options.eventLabel.trim()) : '';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${safeEvent ? `${safeEvent} | ` : ''}Market QR Sign</title>
  <style>
    @page { margin: 0.6in; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: #ffffff;
      color: #111827;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      padding: 32px;
    }
    .toolbar {
      position: fixed;
      top: 16px;
      right: 16px;
      display: flex;
      gap: 8px;
    }
    .toolbar button {
      border: 1px solid #d1d5db;
      background: #111827;
      color: #ffffff;
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
    }
    .card {
      width: 100%;
      max-width: 440px;
      border: 1px solid #e5e7eb;
      border-radius: 16px;
      padding: 40px 32px;
      text-align: center;
    }
    .event {
      margin: 0 0 8px;
      font-size: 12px;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: #6b7280;
    }
    h1 {
      margin: 0 0 24px;
      font-size: 24px;
      font-weight: 600;
      letter-spacing: -0.01em;
      color: #111827;
    }
    .qr {
      width: 280px;
      height: 280px;
      margin: 0 auto 24px;
    }
    .qr svg {
      display: block;
      width: 100%;
      height: 100%;
    }
    .url {
      margin: 0;
      font-size: 15px;
      font-weight: 500;
      color: #374151;
      word-break: break-word;
    }
    @media print {
      .toolbar { display: none; }
      body { padding: 0; }
      .card { border-color: #d1d5db; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <button type="button" onclick="window.print()">Print sign</button>
  </div>
  <main class="card">
    ${safeEvent ? `<p class="event">${safeEvent}</p>` : ''}
    <h1>${safeHeadline}</h1>
    <div class="qr">${trimmedSvg}</div>
    <p class="url">${safeUrl}</p>
  </main>
</body>
</html>`;
}

// --- Customizable Price Sheet, Wall Labels & Booth Card Print Studio ---

export type PriceSheetTemplate = 'price_sheet' | 'wall_labels' | 'booth_sign';
export type PriceSheetPaperSize = 'letter' | '5x7' | '4x6';
export type PriceSheetFontStyle = 'editorial' | 'modern' | 'classic';
export type PriceSheetColorMode = 'brand' | 'ink_saver' | 'warm';
export type PriceSheetDensity = 'spacious' | 'compact';

export interface PriceSheetCustomLine {
  id: string;
  title: string;
  details: string;
  priceLabel: string;
}

export interface PriceSheetConfig {
  template: PriceSheetTemplate;
  paperSize: PriceSheetPaperSize;
  fontStyle: PriceSheetFontStyle;
  colorMode: PriceSheetColorMode;
  density: PriceSheetDensity;
  title: string;
  subtitle: string;
  footerNote: string;
  paymentNote: string;
  qrDestination: MarketQrDestination;
  qrCustomPath: string;
  qrCaption: string;
  showQr: boolean;
  showThumbnails: boolean;
  showDetails: boolean;
  showPrices: boolean;
  showPaymentNote: boolean;
  showPromoCallout: boolean;
  promoCalloutText: string;
  productIds: string[];
  customLines: PriceSheetCustomLine[];
}

export const DEFAULT_PRICE_SHEET_CONFIG: PriceSheetConfig = {
  template: 'price_sheet',
  paperSize: 'letter',
  fontStyle: 'editorial',
  colorMode: 'brand',
  density: 'spacious',
  title: 'Available Works',
  subtitle: 'Original artwork & fine art prints',
  footerNote: 'Shipping and custom commissions available. Ask at the booth.',
  paymentNote: 'Cash · Card · Apple Pay · Venmo',
  qrDestination: 'shop',
  qrCustomPath: '',
  qrCaption: 'Scan to browse online or pay by phone',
  showQr: true,
  showThumbnails: true,
  showDetails: true,
  showPrices: true,
  showPaymentNote: true,
  showPromoCallout: false,
  promoCalloutText: '',
  productIds: [],
  customLines: [],
};

export function normalizePriceSheetConfig(raw: unknown): PriceSheetConfig {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...DEFAULT_PRICE_SHEET_CONFIG };
  }
  const obj = raw as Record<string, unknown>;
  const template: PriceSheetTemplate =
    obj.template === 'wall_labels' || obj.template === 'booth_sign' ? obj.template : 'price_sheet';
  const paperSize: PriceSheetPaperSize =
    obj.paperSize === '5x7' || obj.paperSize === '4x6' ? obj.paperSize : 'letter';
  const fontStyle: PriceSheetFontStyle =
    obj.fontStyle === 'modern' || obj.fontStyle === 'classic' ? obj.fontStyle : 'editorial';
  const colorMode: PriceSheetColorMode =
    obj.colorMode === 'ink_saver' || obj.colorMode === 'warm' ? obj.colorMode : 'brand';
  const density: PriceSheetDensity = obj.density === 'compact' ? 'compact' : 'spacious';
  const qrDestination: MarketQrDestination = MARKET_QR_DESTINATIONS.some((d) => d.key === obj.qrDestination)
    ? (obj.qrDestination as MarketQrDestination)
    : 'shop';

  const productIds = Array.isArray(obj.productIds)
    ? obj.productIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
    : [];
  const customLines: PriceSheetCustomLine[] = Array.isArray(obj.customLines)
    ? obj.customLines
        .filter((line): line is Record<string, unknown> => Boolean(line && typeof line === 'object'))
        .map((line, idx) => ({
          id: typeof line.id === 'string' && line.id.trim() ? line.id : `custom-${idx + 1}`,
          title: typeof line.title === 'string' ? line.title.slice(0, 120) : '',
          details: typeof line.details === 'string' ? line.details.slice(0, 140) : '',
          priceLabel: typeof line.priceLabel === 'string' ? line.priceLabel.slice(0, 40) : '',
        }))
    : [];

  return {
    template,
    paperSize,
    fontStyle,
    colorMode,
    density,
    title: typeof obj.title === 'string' ? obj.title : DEFAULT_PRICE_SHEET_CONFIG.title,
    subtitle: typeof obj.subtitle === 'string' ? obj.subtitle : DEFAULT_PRICE_SHEET_CONFIG.subtitle,
    footerNote: typeof obj.footerNote === 'string' ? obj.footerNote : DEFAULT_PRICE_SHEET_CONFIG.footerNote,
    paymentNote: typeof obj.paymentNote === 'string' ? obj.paymentNote : DEFAULT_PRICE_SHEET_CONFIG.paymentNote,
    qrDestination,
    qrCustomPath: typeof obj.qrCustomPath === 'string' ? obj.qrCustomPath : '',
    qrCaption: typeof obj.qrCaption === 'string' ? obj.qrCaption : DEFAULT_PRICE_SHEET_CONFIG.qrCaption,
    showQr: obj.showQr !== false,
    showThumbnails: obj.showThumbnails !== false,
    showDetails: obj.showDetails !== false,
    showPrices: obj.showPrices !== false,
    showPaymentNote: obj.showPaymentNote !== false,
    showPromoCallout: obj.showPromoCallout === true,
    promoCalloutText: typeof obj.promoCalloutText === 'string' ? obj.promoCalloutText : '',
    productIds,
    customLines,
  };
}

export interface PrintableSheetItem {
  id: string;
  title: string;
  details: string;
  priceLabel: string;
  imageUrl?: string | null;
  qrSvgMarkup?: string | null;
}

function safePrintImageSrc(url?: string | null): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return escapeHtml(trimmed);
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return escapeHtml(parsed.toString());
    }
  } catch {
    // ignore invalid URL
  }
  return '';
}

function safeCssColor(color: string | undefined, fallback: string): string {
  const value = (color ?? '').trim();
  return /^#[0-9a-fA-F]{3,8}$/.test(value) ? value : fallback;
}

/** Generate a customizable, print-ready HTML/PDF document for tabletop price sheets, wall labels, or booth signs. */
export function buildPrintablePriceSheetHtml(options: {
  config: PriceSheetConfig;
  siteName: string;
  eventName?: string | null;
  displayUrl: string;
  masterQrSvg?: string | null;
  items: PrintableSheetItem[];
  brandPrimaryColor?: string;
  brandSurfaceColor?: string;
  hideToolbar?: boolean;
}): string {
  const { config } = options;
  const safeSiteName = escapeHtml(options.siteName.trim() || 'Studio');
  const safeEvent = options.eventName?.trim() ? escapeHtml(options.eventName.trim()) : '';
  const safeTitle = escapeHtml(config.title.trim() || 'Available Works');
  const safeSubtitle = escapeHtml(config.subtitle.trim());
  const safeFooter = escapeHtml(config.footerNote.trim());
  const safePayment = escapeHtml(config.paymentNote.trim());
  const safeQrCaption = escapeHtml(config.qrCaption.trim() || 'Scan to view online');
  const safeUrl = escapeHtml(options.displayUrl.trim());
  const safePromo = escapeHtml(config.promoCalloutText.trim());
  const masterQr = options.masterQrSvg ? assertSvgMarkup(options.masterQrSvg) : '';

  const fontFamily =
    config.fontStyle === 'editorial'
      ? 'Georgia, "Times New Roman", serif'
      : config.fontStyle === 'classic'
        ? 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
        : '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  const bodyFontFamily =
    config.fontStyle === 'classic'
      ? 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
      : '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

  const palette =
    config.colorMode === 'ink_saver'
      ? { bg: '#ffffff', cardBg: '#ffffff', text: '#000000', muted: '#374151', accent: '#000000', border: '#111827' }
      : config.colorMode === 'warm'
        ? { bg: '#faf7f2', cardBg: '#ffffff', text: '#292524', muted: '#57534e', accent: '#78350f', border: '#e7e5e4' }
        : {
            bg: safeCssColor(options.brandSurfaceColor, '#ffffff'),
            cardBg: '#ffffff',
            text: '#111827',
            muted: '#4b5563',
            accent: safeCssColor(options.brandPrimaryColor, '#111827'),
            border: '#e5e7eb',
          };

  const pageSizeCss =
    config.paperSize === '5x7'
      ? '5in 7in'
      : config.paperSize === '4x6'
        ? '4in 6in'
        : 'letter';
  const maxWidthPx =
    config.paperSize === '4x6' ? 420 : config.paperSize === '5x7' ? 520 : 760;
  const padPx = config.density === 'compact' ? 24 : 38;
  const rowGapPx = config.density === 'compact' ? 8 : 14;

  let bodyContent = '';

  if (config.template === 'booth_sign') {
    bodyContent = `
      <main class="sheet sheet-sign">
        <div class="eyebrow">${safeSiteName}${safeEvent ? ` · ${safeEvent}` : ''}</div>
        <h1 class="heading">${safeTitle}</h1>
        ${safeSubtitle ? `<p class="subtitle">${safeSubtitle}</p>` : ''}
        ${config.showQr && masterQr ? `<div class="hero-qr">${masterQr}</div>` : ''}
        ${config.showQr && safeQrCaption ? `<p class="qr-caption">${safeQrCaption}</p>` : ''}
        ${config.showPromoCallout && safePromo ? `<div class="promo-pill">${safePromo}</div>` : ''}
        ${config.showPaymentNote && safePayment ? `<p class="payment-line">${safePayment}</p>` : ''}
        ${safeUrl ? `<p class="url-line">${safeUrl}</p>` : ''}
        ${safeFooter ? `<p class="footer-note">${safeFooter}</p>` : ''}
      </main>`;
  } else if (config.template === 'wall_labels') {
    const labelCards = options.items
      .map((item) => {
        const itemQr = item.qrSvgMarkup ? assertSvgMarkup(item.qrSvgMarkup) : '';
        return `
          <article class="wall-card">
            <div class="wall-card-body">
              <div class="wall-artist">${safeSiteName}</div>
              <h2 class="wall-title">${escapeHtml(item.title || 'Untitled')}</h2>
              ${config.showDetails && item.details ? `<p class="wall-details">${escapeHtml(item.details)}</p>` : ''}
              ${config.showPrices && item.priceLabel ? `<div class="wall-price">${escapeHtml(item.priceLabel)}</div>` : ''}
            </div>
            ${config.showQr && itemQr ? `<div class="wall-qr">${itemQr}<span>Scan for details</span></div>` : ''}
          </article>`;
      })
      .join('');
    bodyContent = `
      <main class="wall-grid-wrap">
        <header class="wall-header">
          <span>${safeSiteName}${safeEvent ? ` · ${safeEvent}` : ''}</span>
          <span>Cut along dashed guides</span>
        </header>
        <section class="wall-grid">${labelCards || '<p class="empty">Select works to print wall labels.</p>'}</section>
      </main>`;
  } else {
    const rowsHtml = options.items
      .map((item) => {
        const imgSrc = config.showThumbnails ? safePrintImageSrc(item.imageUrl) : '';
        return `
          <li class="item-row">
            ${imgSrc ? `<img class="thumb" src="${imgSrc}" alt="${escapeHtml(item.title)}" />` : ''}
            <div class="item-copy">
              <div class="item-title">${escapeHtml(item.title || 'Untitled')}</div>
              ${config.showDetails && item.details ? `<div class="item-details">${escapeHtml(item.details)}</div>` : ''}
            </div>
            ${config.showPrices && item.priceLabel ? `<div class="item-price">${escapeHtml(item.priceLabel)}</div>` : ''}
          </li>`;
      })
      .join('');

    bodyContent = `
      <main class="sheet">
        <header class="sheet-header">
          <div>
            <div class="eyebrow">${safeSiteName}${safeEvent ? ` · ${safeEvent}` : ''}</div>
            <h1 class="heading">${safeTitle}</h1>
            ${safeSubtitle ? `<p class="subtitle">${safeSubtitle}</p>` : ''}
          </div>
          ${config.showPromoCallout && safePromo ? `<div class="promo-pill">${safePromo}</div>` : ''}
        </header>

        <ul class="item-list">
          ${rowsHtml || '<li class="empty">Add products or custom lines to appear on your price sheet.</li>'}
        </ul>

        <footer class="sheet-footer">
          <div class="footer-meta">
            ${config.showPaymentNote && safePayment ? `<p class="payment-line">${safePayment}</p>` : ''}
            ${safeFooter ? `<p class="footer-note">${safeFooter}</p>` : ''}
            ${safeUrl ? `<p class="url-line">${safeUrl}</p>` : ''}
          </div>
          ${
            config.showQr && masterQr
              ? `<div class="footer-qr">
                  <div class="qr-box">${masterQr}</div>
                  <span class="qr-small-caption">${safeQrCaption}</span>
                </div>`
              : ''
          }
        </footer>
      </main>`;
  }

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${safeTitle} | ${safeSiteName}</title>
  <style>
    @page { size: ${pageSizeCss}; margin: 0.45in; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #f3f4f6;
      color: ${palette.text};
      font-family: ${bodyFontFamily};
      padding: 28px 16px 48px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .toolbar {
      max-width: ${maxWidthPx}px;
      margin: 0 auto 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      font-size: 13px;
      color: #4b5563;
    }
    .toolbar button {
      border: 0;
      background: #111827;
      color: #ffffff;
      padding: 9px 18px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
    }
    .sheet {
      max-width: ${maxWidthPx}px;
      margin: 0 auto;
      background: ${palette.bg};
      border: 1px solid ${palette.border};
      border-radius: 12px;
      padding: ${padPx}px;
    }
    .sheet-sign {
      text-align: center;
      padding: ${padPx + 10}px ${padPx}px;
    }
    .sheet-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      padding-bottom: 16px;
      border-bottom: 2px solid ${palette.accent};
    }
    .eyebrow {
      font-size: 11px;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: ${palette.muted};
      margin-bottom: 6px;
    }
    .heading {
      margin: 0;
      font-family: ${fontFamily};
      font-size: ${config.paperSize === '4x6' ? '22px' : '28px'};
      font-weight: 600;
      line-height: 1.15;
      color: ${palette.text};
    }
    .subtitle {
      margin: 6px 0 0;
      font-size: 14px;
      color: ${palette.muted};
    }
    .promo-pill {
      display: inline-block;
      margin-top: 8px;
      padding: 6px 12px;
      border: 1.5px solid ${palette.accent};
      border-radius: 999px;
      font-size: 12px;
      font-weight: 600;
      color: ${palette.accent};
      background: ${palette.cardBg};
    }
    .item-list {
      list-style: none;
      margin: 18px 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: ${rowGapPx}px;
    }
    .item-row {
      display: flex;
      align-items: center;
      gap: 14px;
      padding-bottom: ${rowGapPx}px;
      border-bottom: 1px solid ${palette.border};
    }
    .item-row:last-child { border-bottom: 0; padding-bottom: 0; }
    .thumb {
      width: ${config.density === 'compact' ? '44px' : '56px'};
      height: ${config.density === 'compact' ? '44px' : '56px'};
      object-fit: cover;
      border-radius: 6px;
      border: 1px solid ${palette.border};
      flex-shrink: 0;
    }
    .item-copy { flex: 1; min-width: 0; }
    .item-title {
      font-family: ${fontFamily};
      font-size: ${config.density === 'compact' ? '15px' : '17px'};
      font-weight: 600;
      color: ${palette.text};
    }
    .item-details {
      margin-top: 2px;
      font-size: 12px;
      color: ${palette.muted};
    }
    .item-price {
      font-size: ${config.density === 'compact' ? '15px' : '17px'};
      font-weight: 700;
      color: ${palette.accent};
      white-space: nowrap;
    }
    .sheet-footer {
      margin-top: 20px;
      padding-top: 16px;
      border-top: 1px solid ${palette.border};
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
    }
    .footer-meta { flex: 1; min-width: 0; }
    .payment-line {
      margin: 0 0 6px;
      font-size: 13px;
      font-weight: 600;
      color: ${palette.text};
    }
    .footer-note {
      margin: 0 0 6px;
      font-size: 12px;
      color: ${palette.muted};
    }
    .url-line {
      margin: 6px 0 0;
      font-size: 13px;
      font-weight: 600;
      color: ${palette.accent};
      word-break: break-word;
    }
    .footer-qr {
      display: flex;
      flex-direction: column;
      align-items: center;
      flex-shrink: 0;
      text-align: center;
      max-width: 130px;
    }
    .qr-box {
      width: 96px;
      height: 96px;
      padding: 4px;
      background: #ffffff;
      border: 1px solid ${palette.border};
      border-radius: 8px;
    }
    .qr-box svg, .hero-qr svg, .wall-qr svg { display: block; width: 100%; height: 100%; }
    .qr-small-caption {
      margin-top: 4px;
      font-size: 10px;
      color: ${palette.muted};
      line-height: 1.25;
    }
    .hero-qr {
      width: ${config.paperSize === '4x6' ? '190px' : '240px'};
      height: ${config.paperSize === '4x6' ? '190px' : '240px'};
      margin: 22px auto 14px;
      padding: 8px;
      background: #ffffff;
      border: 1px solid ${palette.border};
      border-radius: 12px;
    }
    .qr-caption {
      margin: 0 0 10px;
      font-size: 15px;
      font-weight: 500;
      color: ${palette.text};
    }
    .wall-grid-wrap {
      max-width: 780px;
      margin: 0 auto;
      background: #ffffff;
      padding: 20px;
      border-radius: 12px;
      border: 1px solid #e5e7eb;
    }
    .wall-header {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      color: #6b7280;
      margin-bottom: 12px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .wall-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }
    .wall-card {
      border: 1px dashed ${palette.border};
      padding: 16px;
      background: ${palette.bg};
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      break-inside: avoid;
      min-height: 126px;
    }
    .wall-card-body { flex: 1; min-width: 0; }
    .wall-artist {
      font-size: 10px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: ${palette.muted};
    }
    .wall-title {
      margin: 4px 0 4px;
      font-family: ${fontFamily};
      font-size: 16px;
      font-weight: 600;
      color: ${palette.text};
    }
    .wall-details {
      margin: 0;
      font-size: 11px;
      color: ${palette.muted};
    }
    .wall-price {
      margin-top: 8px;
      font-size: 15px;
      font-weight: 700;
      color: ${palette.accent};
    }
    .wall-qr {
      width: 74px;
      flex-shrink: 0;
      text-align: center;
    }
    .wall-qr svg {
      width: 72px;
      height: 72px;
      background: #ffffff;
      padding: 2px;
      border: 1px solid ${palette.border};
      border-radius: 4px;
    }
    .wall-qr span {
      display: block;
      margin-top: 3px;
      font-size: 9px;
      color: ${palette.muted};
    }
    .empty { color: #6b7280; font-size: 13px; text-align: center; padding: 24px; }
    @media print {
      body { background: #ffffff; padding: 0; }
      .toolbar { display: none; }
      .sheet, .wall-grid-wrap { border: 0; border-radius: 0; max-width: none; padding: 0; }
      .sheet-sign { border: 1px solid ${palette.border}; border-radius: 12px; padding: ${padPx}px; }
    }
  </style>
</head>
<body>
  ${
    options.hideToolbar
      ? ''
      : `<div class="toolbar">
    <span>Use your browser print dialog to print or Save as PDF.</span>
    <button type="button" onclick="window.print()">Print / Save PDF</button>
  </div>`
  }
  ${bodyContent}
</body>
</html>`;
}

// --- Bookkeeping P&L & Accounting CSV Export ---

export interface MarketSaleLedgerEntry {
  id: string;
  orderNumber: string;
  createdAt: string;
  eventName: string;
  paymentMethod: string;
  status: string;
  subtotal: number;
  tax: number;
  total: number;
  itemCount: number;
  itemsSummary: string;
  buyerEmail: string;
}

export interface MarketBookkeepingSummary {
  saleCount: number;
  itemCount: number;
  grossSales: number;
  subtotal: number;
  taxCollected: number;
  boothFee: number;
  otherExpenses: number;
  totalExpenses: number;
  netProfit: number;
  averageSale: number;
  byMethod: Record<string, { count: number; total: number }>;
}

function roundCents(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

/** Compute accounting totals and P&L across paid in-person/market orders. */
export function computeMarketSummary(
  sales: Array<{
    status: string;
    paymentMethod?: string | null;
    subtotal: number;
    tax: number;
    total: number;
    itemCount: number;
  }>,
  expenses: { boothFee?: number; otherExpenses?: number } = {},
): MarketBookkeepingSummary {
  const activeSales = sales.filter(
    (s) => s.status !== 'cancelled' && s.status !== 'refunded' && s.status !== 'pending' && s.status !== 'failed',
  );
  const byMethod: Record<string, { count: number; total: number }> = {};

  let grossSales = 0;
  let subtotal = 0;
  let taxCollected = 0;
  let itemCount = 0;

  for (const sale of activeSales) {
    grossSales += Number(sale.total) || 0;
    subtotal += Number(sale.subtotal) || 0;
    taxCollected += Number(sale.tax) || 0;
    itemCount += Number(sale.itemCount) || 0;
    const methodKey = sale.paymentMethod || 'other';
    if (!byMethod[methodKey]) {
      byMethod[methodKey] = { count: 0, total: 0 };
    }
    byMethod[methodKey].count += 1;
    byMethod[methodKey].total = roundCents(byMethod[methodKey].total + (Number(sale.total) || 0));
  }

  const boothFee = roundCents(Math.max(0, Number(expenses.boothFee) || 0));
  const otherExpenses = roundCents(Math.max(0, Number(expenses.otherExpenses) || 0));
  const totalExpenses = roundCents(boothFee + otherExpenses);
  const roundedGross = roundCents(grossSales);
  const roundedSubtotal = roundCents(subtotal);
  const roundedTax = roundCents(taxCollected);
  const netProfit = roundCents(roundedSubtotal - totalExpenses);
  const averageSale = activeSales.length > 0 ? roundCents(roundedGross / activeSales.length) : 0;

  return {
    saleCount: activeSales.length,
    itemCount,
    grossSales: roundedGross,
    subtotal: roundedSubtotal,
    taxCollected: roundedTax,
    boothFee,
    otherExpenses,
    totalExpenses,
    netProfit,
    averageSale,
    byMethod,
  };
}

function escapeCsvCell(value: string | number): string {
  const raw = String(value ?? '');
  // Guard against spreadsheet formula injection when opened in Excel/Sheets
  const safe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  if (/[",\n\r]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

/** Format market sales into a clean, accountant-ready RFC-4180 CSV file. */
export function buildMarketSalesCsv(rows: MarketSaleLedgerEntry[]): string {
  const headers = [
    'Date',
    'Order Number',
    'Market Event',
    'Status',
    'Payment Method',
    'Items',
    'Quantity',
    'Subtotal',
    'Sales Tax',
    'Total',
    'Buyer Email',
  ];
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(
      [
        escapeCsvCell(row.createdAt),
        escapeCsvCell(row.orderNumber),
        escapeCsvCell(row.eventName),
        escapeCsvCell(row.status),
        escapeCsvCell(marketPaymentMethodLabel(row.paymentMethod)),
        escapeCsvCell(row.itemsSummary),
        escapeCsvCell(row.itemCount),
        escapeCsvCell(roundCents(row.subtotal).toFixed(2)),
        escapeCsvCell(roundCents(row.tax).toFixed(2)),
        escapeCsvCell(roundCents(row.total).toFixed(2)),
        escapeCsvCell(row.buyerEmail),
      ].join(','),
    );
  }
  return `${lines.join('\r\n')}\r\n`;
}
