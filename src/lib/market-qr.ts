export const MARKET_QR_DESTINATIONS = [
  { key: 'home', label: 'Home', path: '/', prompt: 'Scan to visit the site' },
  { key: 'shop', label: 'Shop', path: '/shop', prompt: 'Scan to browse the shop' },
  { key: 'subscribe', label: 'Newsletter signup', path: '/subscribe', prompt: 'Scan to join the mailing list' },
  { key: 'portfolio', label: 'Portfolio', path: '/portfolio', prompt: 'Scan to explore the portfolio' },
  { key: 'contact', label: 'Contact', path: '/contact', prompt: 'Scan to get in touch' },
  { key: 'custom', label: 'Custom page…', path: '/', prompt: 'Scan to open page' },
] as const;

export type MarketQrDestination = (typeof MARKET_QR_DESTINATIONS)[number]['key'];

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

/** Generate a minimal, gallery-grade printable sign HTML document with an inline vector QR code. */
export function buildPrintableQrSignHtml(options: {
  svgMarkup: string;
  headline: string;
  displayUrl: string;
  eventLabel?: string | null;
}): string {
  const trimmedSvg = options.svgMarkup.trim();
  if (!trimmedSvg.startsWith('<svg') || !trimmedSvg.endsWith('</svg>')) {
    throw new Error('Invalid QR SVG markup.');
  }
  const safeHeadline = escapeHtml(options.headline.trim() || 'Scan to visit');
  const safeUrl = escapeHtml(options.displayUrl.trim());
  const safeEvent = options.eventLabel?.trim() ? escapeHtml(options.eventLabel.trim()) : '';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${safeEvent ? `${safeEvent} — ` : ''}Market QR Sign</title>
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
