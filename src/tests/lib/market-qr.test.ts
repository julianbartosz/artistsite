import {
  buildMarketKioskUrl,
  buildMarketPayUrl,
  buildMarketQrFilename,
  buildMarketQrUrl,
  buildMarketSalesCsv,
  buildPrintablePriceSheetHtml,
  buildPrintableQrSignHtml,
  computeMarketSummary,
  formatMarketQrDisplayUrl,
  isLocalOrigin,
  MARKET_QR_DESTINATIONS,
  normalizeMarketQrPath,
  normalizePriceSheetConfig,
  parseMarketPayParams,
  slugifyMarketCampaign,
} from '@/lib/market-qr';
import {
  computeDepositAndBalance,
  computeJobPricing,
  computeQuotedDueDate,
  isJobTermsLocked,
  normalizeCommissionStatus,
  normalizeJobTemplates,
  normalizeLicenseType,
  type LicenseType,
} from '@/lib/jobs-shared';

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

  it('builds and round-trips Pay-at-Market express checkout URLs for single and multi-item sales', () => {
    const singleUrl = buildMarketPayUrl(
      'https://michalelena.art',
      [{ productId: 'mushroom-postcard', quantity: 2 }],
      { eventSlug: 'Spring Fair', promoCode: 'fair15' },
    );
    expect(singleUrl).toBe(
      'https://michalelena.art/checkout?mode=market&sku=mushroom-postcard&qty=2&event=spring-fair&utm_source=market&utm_medium=pay_qr&utm_campaign=spring-fair&promo=FAIR15',
    );
    expect(parseMarketPayParams(new URL(singleUrl).searchParams)).toEqual({
      isMarketMode: true,
      items: [{ productId: 'mushroom-postcard', quantity: 2 }],
      eventSlug: 'spring-fair',
      promoCode: 'FAIR15',
    });

    const multiUrl = buildMarketPayUrl(
      'https://michalelena.art',
      [
        { productId: 'print-a', quantity: 1 },
        { productId: 'print-b', quantity: 3 },
      ],
      { eventSlug: 'Autumn Show' },
    );
    expect(parseMarketPayParams(new URL(multiUrl).searchParams)).toEqual({
      isMarketMode: true,
      items: [
        { productId: 'print-a', quantity: 1 },
        { productId: 'print-b', quantity: 3 },
      ],
      eventSlug: 'autumn-show',
      promoCode: '',
    });

    expect(buildMarketKioskUrl('https://michalelena.art', 'Spring Fair')).toBe(
      'https://michalelena.art/subscribe?kiosk=1&event=spring-fair&utm_source=market&utm_medium=kiosk&utm_campaign=spring-fair',
    );
  });

  it.each(['price_sheet', 'wall_labels', 'booth_sign'] as const)(
    'generates escaped printable HTML for %s template with custom typography and palette',
    (template) => {
      const config = normalizePriceSheetConfig({
        template,
        paperSize: 'letter',
        fontStyle: 'editorial',
        colorMode: 'warm',
        title: 'Spring <script>Fair</script>',
        showPromoCallout: true,
        promoCalloutText: 'Use FAIR15',
      });
      const html = buildPrintablePriceSheetHtml({
        config,
        siteName: 'Studio & Co',
        eventName: 'Spring Fair',
        displayUrl: 'michalelena.art/shop',
        masterQrSvg: '<svg viewBox="0 0 10 10"></svg>',
        items: [
          {
            id: 'p1',
            title: 'Forest Study <img src=x>',
            details: 'Oil on linen · 12x16"',
            priceLabel: '$450.00',
            imageUrl: '/uploads/forest.jpg',
            qrSvgMarkup: '<svg viewBox="0 0 8 8"></svg>',
          },
        ],
      });
      expect(html).not.toContain('<script>Fair</script>');
      expect(html).toContain('Spring &lt;script&gt;Fair&lt;/script&gt;');
      if (template === 'wall_labels') {
        expect(html).toContain('<svg viewBox="0 0 8 8"></svg>');
      } else {
        expect(html).toContain('<svg viewBox="0 0 10 10"></svg>');
      }
      if (template !== 'booth_sign') {
        expect(html).toContain('Forest Study &lt;img src=x&gt;');
        expect(html).toContain('$450.00');
      }
    },
  );

  it('computes event P&L accurately excluding voided orders and exports formula-safe RFC-4180 CSV', () => {
    const summary = computeMarketSummary(
      [
        { status: 'delivered', paymentMethod: 'cash', subtotal: 100, tax: 8, total: 108, itemCount: 2 },
        { status: 'delivered', paymentMethod: 'venmo', subtotal: 50, tax: 4, total: 54, itemCount: 1 },
        { status: 'cancelled', paymentMethod: 'cash', subtotal: 75, tax: 6, total: 81, itemCount: 1 },
      ],
      { boothFee: 80, otherExpenses: 20 },
    );
    expect(summary.saleCount).toBe(2);
    expect(summary.grossSales).toBe(162);
    expect(summary.subtotal).toBe(150);
    expect(summary.taxCollected).toBe(12);
    expect(summary.totalExpenses).toBe(100);
    expect(summary.netProfit).toBe(50);
    expect(summary.averageSale).toBe(81);
    expect(summary.byMethod).toEqual({
      cash: { count: 1, total: 108 },
      venmo: { count: 1, total: 54 },
    });

    const csv = buildMarketSalesCsv([
      {
        id: '1',
        orderNumber: 'ORD-100',
        createdAt: '2026-11-25T15:00:00.000Z',
        eventName: '=CMD("bad")',
        paymentMethod: 'cash',
        status: 'delivered',
        subtotal: 100,
        tax: 8,
        total: 108,
        itemCount: 2,
        itemsSummary: 'Forest Study, "Small" Print',
        buyerEmail: '+buyer@example.com',
      },
    ]);
    expect(csv).toContain("'=CMD");
    expect(csv).toContain("'+buyer@example.com");
    expect(csv).toContain('"Forest Study, ""Small"" Print"');
  });
});

describe('jobs-shared commission, pricing, blackout & template helpers', () => {
  it.each([
    [10000, 50, 5000, 5000],
    [10001, 50, 5001, 5000],
    [10000, 100, 10000, 0],
    [10000, 0, 0, 10000],
    [75000, 30, 22500, 52500],
    [-500, 50, 0, 0],
  ])('computes exact deposit/balance cent split for total=%i deposit=%i%%', (total, pct, expDep, expBal) => {
    const split = computeDepositAndBalance(total, pct);
    expect(split.depositCents).toBe(expDep);
    expect(split.balanceCents).toBe(expBal);
    expect(split.depositCents + split.balanceCents).toBe(split.totalCents);
  });

  it.each<[LicenseType, number, number]>([
    ['personal', 0, 66000],
    ['commercial', 0, 99000],
    ['exclusive', 0, 148500],
    ['personal', 25, 82500],
  ])('calculates studio pricing helper for license=%s rush=%i%%', (licenseType, rushPercent, expectedTotalCents) => {
    const res = computeJobPricing({
      hours: 8,
      hourlyRate: 75,
      materials: 60,
      rushPercent,
      licenseType,
      depositPercent: 50,
    });
    expect(res.totalCents).toBe(expectedTotalCents);
    expect(res.depositCents + res.balanceCents).toBe(res.totalCents);
  });

  it.each([
    ['2026-12-01', 14, null, null, '2026-12-15'],
    ['2026-12-01', 14, '2026-12-05', '2026-12-09', '2026-12-20'],
    ['2026-12-01', 14, '2026-12-20', '2026-12-25', '2026-12-15'],
    ['2026-12-01', 10, '2026-11-28', '2026-12-03', '2026-12-14'],
  ])('computes turnaround due date from %s (+%id) with blackout %s..%s -> %s', (start, days, bStart, bEnd, expected) => {
    const due = computeQuotedDueDate(new Date(`${start}T12:00:00Z`), days, bStart, bEnd);
    expect(due.toISOString().slice(0, 10)).toBe(expected);
  });

  it('normalizes commission status, license tiers, templates, and terms lock state', () => {
    expect(normalizeCommissionStatus('waitlist')).toBe('waitlist');
    expect(normalizeCommissionStatus('closed')).toBe('closed');
    expect(normalizeCommissionStatus('invalid')).toBe('open');
    expect(normalizeLicenseType('commercial')).toBe('commercial');
    expect(normalizeLicenseType('bogus', 'exclusive')).toBe('exclusive');
    expect(isJobTermsLocked({ acceptedAt: null, depositPaidAt: null })).toBe(false);
    expect(isJobTermsLocked({ acceptedAt: '2026-11-26T00:00:00Z', depositPaidAt: null })).toBe(true);

    const templates = normalizeJobTemplates([
      { id: 'portrait', depositPercent: 40, turnaroundDays: 14, revisionCap: 3 },
    ]);
    const portrait = templates.find((t) => t.id === 'portrait');
    expect(portrait?.depositPercent).toBe(40);
    expect(portrait?.turnaroundDays).toBe(14);
    expect(portrait?.revisionCap).toBe(3);
    expect(templates.length).toBe(4);
  });
});
