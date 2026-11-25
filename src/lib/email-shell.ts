import { DEFAULT_THEME_PRIMARY } from '@/lib/site-content-shared';

/** Shared look for every outgoing email: newsletters and transactional messages render through `emailShellHtml`. */

export type EmailBrand = {
  siteName: string;
  siteUrl: string;
  primaryColor: string;
};

export const EMAIL_FONT_STACK = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

/** Extracts the bare email address from either `user@domain` or `Name <user@domain>`. */
export function extractEmailAddress(from: string | null | undefined): string {
  const value = (from || '').trim();
  if (!value) return '';
  const open = value.lastIndexOf('<');
  const close = value.lastIndexOf('>');
  return open !== -1 && close > open ? value.slice(open + 1, close).trim() : value;
}

/** True when the sender uses Resend's sandbox domain (`@resend.dev`), which only delivers to the account owner. */
export function isResendSandboxSender(from: string | null | undefined): boolean {
  const address = extractEmailAddress(from).toLowerCase();
  return address.endsWith('@resend.dev');
}

export function escapeHtml(value: string): string {
  return value
    .split('&').join('&amp;')
    .split('<').join('&lt;')
    .split('>').join('&gt;')
    .split('"').join('&quot;')
    .split("'").join('&#39;');
}

export function normalizeEmailColor(value: string): string {
  const hex = value.trim().toLowerCase();
  if (hex.length !== 7 || !hex.startsWith('#')) return DEFAULT_THEME_PRIMARY;
  for (const char of hex.slice(1)) {
    if (!'0123456789abcdef'.includes(char)) return DEFAULT_THEME_PRIMARY;
  }
  return hex;
}

function readableTextOn(hex: string): string {
  const channel = (offset: number) => {
    const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
  return luminance > 0.45 ? '#111827' : '#ffffff';
}

export function emailButtonHtml(label: string, href: string, color: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;"><tr><td style="border-radius:8px;background:${color};"><a href="${escapeHtml(href)}" style="display:inline-block;padding:13px 26px;font:600 15px/1.2 ${EMAIL_FONT_STACK};color:${readableTextOn(color)};text-decoration:none;border-radius:8px;">${escapeHtml(label)}</a></td></tr></table>`;
}

export function emailShellHtml({
  brand,
  title,
  bodyHtml,
  footerHtml,
  preheader = '',
  extraCss = '',
}: {
  brand: EmailBrand;
  title: string;
  bodyHtml: string;
  footerHtml: string;
  preheader?: string;
  extraCss?: string;
}): string {
  const siteName = brand.siteName.trim() || 'Studio';
  const siteHref = brand.siteUrl.trim();
  const brandLink = siteHref
    ? `<a href="${escapeHtml(siteHref)}" style="color:#111827;text-decoration:none;">${escapeHtml(siteName)}</a>`
    : escapeHtml(siteName);
  const accentRule = `<div style="height:4px;background:${normalizeEmailColor(brand.primaryColor)};border-radius:12px 12px 0 0;"></div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapeHtml(title)}</title>
<style>
${extraCss}
@media (max-width:620px){.email-card{padding:28px 22px !important;}}
</style>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;">
${preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${escapeHtml(preheader)}&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;</div>` : ''}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;">
<tr><td align="center" style="padding:32px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
<tr><td style="padding:0 6px 16px;font:600 15px/1.4 ${EMAIL_FONT_STACK};letter-spacing:0.02em;color:#111827;">${brandLink}</td></tr>
<tr><td>${accentRule}</td></tr>
<tr><td class="email-card" style="background:#ffffff;border-radius:0 0 12px 12px;padding:40px 44px 12px;font:16px/1.65 ${EMAIL_FONT_STACK};color:#374151;">${bodyHtml}</td></tr>
<tr><td style="padding:24px 12px;font:12px/1.6 ${EMAIL_FONT_STACK};color:#6b7280;text-align:center;">${footerHtml}</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}
