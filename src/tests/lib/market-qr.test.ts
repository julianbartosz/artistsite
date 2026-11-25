import {
  buildMarketQrFilename,
  buildMarketQrUrl,
  buildPrintableQrSignHtml,
  formatMarketQrDisplayUrl,
  isLocalOrigin,
  MARKET_QR_DESTINATIONS,
  normalizeMarketQrPath,
  slugifyMarketCampaign,
} from '@/lib/market-qr';

describe('market QR URL builder', () => {
  it('exposes storefront presets starting with home and including newsletter signup + custom page', () => {
    expect(MARKET_QR_DESTINATIONS.map((preset) => [preset.key, preset.path])).toEqual([
      ['home', '/'],
      ['shop', '/shop'],
      ['subscribe', '/subscribe'],
      ['portfolio', '/portfolio'],
      ['contact', '/contact'],
      ['custom', '/'],
    ]);
  });

  it.each([
    ['https://michalelena.art', undefined, undefined, undefined, 'https://michalelena.art/?utm_source=market&utm_medium=qr&utm_campaign=market'],
    ['https://michalelena.art/', 'shop', 'Spring Fair', undefined, 'https://michalelena.art/shop?utm_source=market&utm_medium=qr&utm_campaign=spring-fair'],
    ['https://michalelena.art', 'subscribe', 'Booth Sign', undefined, 'https://michalelena.art/subscribe?utm_source=market&utm_medium=qr&utm_campaign=booth-sign'],
    ['https://michalelena.art/ignored/path', 'portfolio', 'Autumn Market 2026', undefined, 'https://michalelena.art/portfolio?utm_source=market&utm_medium=qr&utm_campaign=autumn-market-2026'],
    ['https://michalelena.art', 'contact', 'Open Studio', undefined, 'https://michalelena.art/contact?utm_source=market&utm_medium=qr&utm_campaign=open-studio'],
    ['https://michalelena.art', 'custom', 'Spring Fair', '/shop/mushroom-postcard', 'https://michalelena.art/shop/mushroom-postcard?utm_source=market&utm_medium=qr&utm_campaign=spring-fair'],
    ['https://michalelena.art', 'custom', 'Spring Fair', 'https://michalelena.art/blog/studio-update?utm_source=old&ref=card', 'https://michalelena.art/blog/studio-update?ref=card&utm_source=market&utm_medium=qr&utm_campaign=spring-fair'],
  ] as const)(
    'builds absolute URLs with market UTMs (%s, %s, %s)',
    (origin, dest, label, customPath, expected) => {
      expect(buildMarketQrUrl(origin, dest, label, customPath)).toBe(expected);
    },
  );

  it('rejects external origins and protocol-relative custom paths', () => {
    expect(() => normalizeMarketQrPath('https://evil.com/phish', 'https://michalelena.art')).toThrow();
    expect(() => normalizeMarketQrPath('//evil.com/phish', 'https://michalelena.art')).toThrow();
    expect(() => normalizeMarketQrPath('javascript:alert(1)', 'https://michalelena.art')).toThrow();
    expect(normalizeMarketQrPath('shop/item-1', 'https://michalelena.art')).toBe('/shop/item-1');
  });

  it('detects local/non-public origins accurately', () => {
    expect(isLocalOrigin('http://localhost:3000')).toBe(true);
    expect(isLocalOrigin('http://127.0.0.1:3000')).toBe(true);
    expect(isLocalOrigin('http://0.0.0.0:3000')).toBe(true);
    expect(isLocalOrigin('http://[::1]:3000')).toBe(true);
    expect(isLocalOrigin('http://studio.local:3000')).toBe(true);
    expect(isLocalOrigin('https://michalelena.art')).toBe(false);
  });

  it('slugifies labels safely and falls back to market when blank or punctuation-only', () => {
    expect(slugifyMarketCampaign('')).toBe('market');
    expect(slugifyMarketCampaign('   ')).toBe('market');
    expect(slugifyMarketCampaign('!!! --- ???')).toBe('market');
    expect(slugifyMarketCampaign('  Café & Gallery — #2! ')).toBe('cafe-gallery-2');
    expect(slugifyMarketCampaign('a'.repeat(80)).length).toBeLessThanOrEqual(48);
  });

  it('builds clean PNG and SVG filenames and human-readable display URLs', () => {
    expect(buildMarketQrFilename('home', '')).toBe('qr-market.png');
    expect(buildMarketQrFilename('home', 'Spring Fair')).toBe('qr-spring-fair.png');
    expect(buildMarketQrFilename('shop', 'Spring Fair', 'svg')).toBe('qr-spring-fair-shop.svg');
    expect(buildMarketQrFilename('subscribe', null)).toBe('qr-market-subscribe.png');
    expect(buildMarketQrFilename('custom', 'Spring Fair', 'png', '/shop/mushroom-postcard')).toBe(
      'qr-spring-fair-mushroom-postcard.png',
    );
    expect(formatMarketQrDisplayUrl('https://michalelena.art/?utm_source=market')).toBe('michalelena.art');
    expect(formatMarketQrDisplayUrl('https://michalelena.art/shop/?utm_source=market')).toBe('michalelena.art/shop');
  });

  it('escapes dynamic text in printable QR sign HTML and validates SVG markup', () => {
    const html = buildPrintableQrSignHtml({
      svgMarkup: '<svg viewBox="0 0 10 10"></svg>',
      headline: 'Scan <script>alert(1)</script>',
      displayUrl: 'michalelena.art/shop',
      eventLabel: 'Spring & "Summer" Fair',
    });
    expect(html).toContain('<svg viewBox="0 0 10 10"></svg>');
    expect(html).toContain('Scan &lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('Spring &amp; &quot;Summer&quot; Fair');
    expect(() =>
      buildPrintableQrSignHtml({
        svgMarkup: '<script>alert(1)</script>',
        headline: 'Bad',
        displayUrl: 'michalelena.art',
      }),
    ).toThrow();
  });
});
