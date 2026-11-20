import type { Order, OrderStatus } from './orders';
import { createOrderTrackingPath } from '@/lib/order-access';
import { formatCartItemVariant } from './commerce';
import nodemailer from 'nodemailer';
import { getConfig, getSiteUrl } from '@/lib/config';
import { trackingUrl } from '@/lib/shipping';
import { getPublishedSiteContent } from '@/lib/site-content';
import { emailButtonHtml, emailShellHtml, escapeHtml, normalizeEmailColor, type EmailBrand } from '@/lib/email-shell';
import { absoluteUrl } from '@/lib/utils';

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

/** Saved identity only, so emails never pick up an admin's unsaved preview. */
export async function getEmailBrand(): Promise<EmailBrand> {
  const [identity, siteUrl] = await Promise.all([getPublishedSiteContent('identity'), getSiteUrl()]);
  return { siteName: identity.siteName.trim() || 'Studio', siteUrl, primaryColor: identity.theme.primaryColor };
}

export function generatePasswordResetEmail(resetUrl: string, expiresMinutes: number, brand: EmailBrand): EmailTemplate {
  const expiry = `This link expires in ${expiresMinutes} minutes. If you did not request this, you can ignore this email.`;
  return {
    subject: `Reset your ${brand.siteName} password`,
    html: brandedEmailHtml(brand, {
      title: 'Reset your password',
      intro: 'We received a request to reset your password.',
      cta: { label: 'Reset password', href: resetUrl },
      closing: expiry,
    }),
    text: `Reset your password: ${resetUrl}\n\n${expiry}`,
  };
}

export type EmailSendOptions = {
  fromName?: string;
  replyTo?: string;
  headers?: Record<string, string>;
};

export type EmailDeliveryStatus = {
  mode: 'smtp' | 'log' | 'unconfigured';
  fromAddress: string;
};

async function resolveDeliveryMode(): Promise<string> {
  return await getConfig('EMAIL_DELIVERY_MODE') || (process.env.NODE_ENV === 'production' ? 'smtp' : 'log');
}

/** Bare address from SMTP_FROM, which may be written as `Name <address>`. */
function senderAddress(from: string): string {
  const open = from.lastIndexOf('<');
  const close = from.lastIndexOf('>');
  return open !== -1 && close > open ? from.slice(open + 1, close).trim() : from.trim();
}

export async function getEmailDeliveryStatus(): Promise<EmailDeliveryStatus> {
  const [mode, host, user, pass, from] = await Promise.all([
    resolveDeliveryMode(),
    getConfig('SMTP_HOST'),
    getConfig('SMTP_USER'),
    getConfig('SMTP_PASSWORD'),
    getConfig('SMTP_FROM'),
  ]);
  const fromAddress = senderAddress(from || user || '');
  if (mode === 'log') return { mode: 'log', fromAddress };
  return { mode: host && user && pass ? 'smtp' : 'unconfigured', fromAddress };
}

export async function sendTemplateEmail(to: string, template: EmailTemplate, options: EmailSendOptions = {}): Promise<boolean> {
  try {
    if (process.env.PLAYWRIGHT_E2E === 'true') {
      console.log(`Email delivery e2e log mode; skipped ${template.subject} for ${to}`);
      return true;
    }

    const deliveryMode = await resolveDeliveryMode();
    if (deliveryMode === 'log') {
      if (process.env.NODE_ENV !== 'production') {
        console.log(`Email delivery log mode; skipped ${template.subject} for ${to}`);
      }
      return true;
    }

    const host = await getConfig('SMTP_HOST');
    const port = Number(await getConfig('SMTP_PORT') || 587);
    const user = await getConfig('SMTP_USER');
    const pass = await getConfig('SMTP_PASSWORD');

    if (!host || !user || !pass) {
      if (process.env.NODE_ENV === 'production') {
        return false;
      }
      console.log(`Email transport not configured; skipped ${template.subject} for ${to}`);
      return true;
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    const from = await getConfig('SMTP_FROM') || user;
    const fromName = options.fromName?.trim();
    await transporter.sendMail({
      from: fromName ? { name: fromName, address: senderAddress(from) } : from,
      to,
      subject: template.subject,
      html: template.html,
      text: template.text,
      ...(options.replyTo ? { replyTo: options.replyTo } : {}),
      ...(options.headers ? { headers: options.headers } : {}),
    });

    return true;
  } catch (error) {
    console.error('Failed to send email:', error);
    return false;
  }
}

/** Section and row values are HTML; escape any user-supplied text before passing it in. */
export type EmailSection = { heading?: string; html: string };

const money = (value: number) => `$${value.toFixed(2)}`;
const MUTED = 'color:#6b7280;';
const ROW = 'padding:6px 0;border-bottom:1px solid #f3f4f6;';

export function emailDetailRows(rows: Array<[string, string]>): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows
    .map(([label, value]) => `<tr><td style="${ROW}${MUTED}">${escapeHtml(label)}</td><td style="${ROW}text-align:right;color:#111827;">${value}</td></tr>`)
    .join('')}</table>`;
}

/** Plain text (for example a visitor's message), escaped and set off with the brand color. */
export function emailQuoteHtml(text: string, brand: EmailBrand): string {
  return `<div style="white-space:pre-wrap;border-left:3px solid ${normalizeEmailColor(brand.primaryColor)};padding:4px 0 4px 14px;">${escapeHtml(text)}</div>`;
}

export function brandedEmailHtml(
  brand: EmailBrand,
  { title, intro, sections = [], cta, closing, footerHtml = escapeHtml(brand.siteName) }: {
    title: string;
    intro: string;
    sections?: EmailSection[];
    cta?: { label: string; href: string };
    closing?: string;
    footerHtml?: string;
  },
): string {
  const color = normalizeEmailColor(brand.primaryColor);
  const body = [
    `<h1 style="margin:0 0 8px;font-size:24px;line-height:1.3;color:#111827;">${escapeHtml(title)}</h1>`,
    `<p style="margin:0 0 28px;">${intro}</p>`,
    ...sections.map((section) => `<div style="margin:0 0 28px;">${section.heading
      ? `<h2 style="margin:0 0 10px;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;${MUTED}">${escapeHtml(section.heading)}</h2>`
      : ''}${section.html}</div>`),
    cta ? `<div style="margin:0 0 28px;">${emailButtonHtml(cta.label, cta.href, color)}</div>` : '',
    closing ? `<p style="margin:0 0 28px;">${closing}</p>` : '',
  ].join('');

  return emailShellHtml({ brand, title, bodyHtml: body, footerHtml });
}

function orderEmailHtml(brand: EmailBrand, content: Parameters<typeof brandedEmailHtml>[1]): string {
  return brandedEmailHtml(brand, {
    ...content,
    footerHtml: `Questions about your order? Just reply to this email.<br>${escapeHtml(brand.siteName)}`,
  });
}

export class OrderEmailService {
  private static customerName(order: Order): string {
    return `${order.shippingAddress.firstName} ${order.shippingAddress.lastName}`.trim() || order.customerEmail;
  }

  static generateConfirmationEmail(order: Order, brand: EmailBrand): EmailTemplate {
    const customerName = this.customerName(order);
    const orderUrl = absoluteUrl(createOrderTrackingPath(order.id), brand.siteUrl);
    const status = order.status.charAt(0).toUpperCase() + order.status.slice(1);
    const subject = `Order Confirmation - ${order.orderNumber}`;
    const address = order.shippingAddress;

    const items = order.items.map((item) => {
      const variant = formatCartItemVariant(item.selectedVariant);
      const extras = [
        variant ? `Variant: ${escapeHtml(variant)}` : '',
        item.customizations?.length ? `Customizations: ${escapeHtml(item.customizations.map((c) => c.name).join(', '))}` : '',
      ].filter(Boolean).join('<br>');
      return `<tr><td style="${ROW}"><strong style="color:#111827;">${escapeHtml(item.product.title)}</strong>${extras ? `<br><span style="font-size:14px;${MUTED}">${extras}</span>` : ''}<br><span style="font-size:14px;${MUTED}">${item.quantity} × ${money(item.unitPrice)}</span></td><td style="${ROW}text-align:right;vertical-align:top;color:#111827;">${money(item.totalPrice)}</td></tr>`;
    }).join('');

    const sections: EmailSection[] = [
      {
        html: emailDetailRows([
          ['Order number', escapeHtml(order.orderNumber)],
          ['Order date', escapeHtml(order.createdAt.toLocaleDateString())],
          ['Status', escapeHtml(status)],
        ]),
      },
      {
        heading: 'Items',
        html: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${items}</table>${emailDetailRows([
          ['Subtotal', money(order.subtotal)],
          ['Shipping', money(order.shipping)],
          ['Tax', money(order.tax)],
          ['Total', `<strong>${money(order.total)}</strong>`],
        ])}`,
      },
      {
        heading: 'Shipping to',
        html: [
          `${address.firstName} ${address.lastName}`,
          address.company,
          address.address1,
          address.address2,
          `${address.city}, ${address.state} ${address.postalCode}`,
          address.country,
        ].filter(Boolean).map((line) => escapeHtml(String(line))).join('<br>'),
      },
    ];
    if (order.specialInstructions) {
      sections.push({ heading: 'Special instructions', html: escapeHtml(order.specialInstructions) });
    }
    if (order.type === 'commission') {
      sections.push({
        heading: 'Commission order',
        html: `<div style="border-left:3px solid ${normalizeEmailColor(brand.primaryColor)};padding:4px 0 4px 14px;">This is a custom commission. I will contact you within 24–48 hours to talk through details, timeline, and next steps.</div>`,
      });
    }

    const html = orderEmailHtml(brand, {
      title: 'Order confirmed',
      intro: `Thank you for your purchase, ${escapeHtml(customerName)}. We'll email you as your order moves along.`,
      sections,
      cta: { label: 'View order status', href: orderUrl },
      closing: 'Thank you for supporting independent art!',
    });

    const text = `
Order Confirmation - ${order.orderNumber}

Thank you for your purchase, ${customerName}!

Order Details:
- Order Number: ${order.orderNumber}
- Order Date: ${order.createdAt.toLocaleDateString()}
- Status: ${status}

Items Ordered:
${order.items.map(item => `
- ${item.product.title}
  ${formatCartItemVariant(item.selectedVariant) ? `Variant: ${formatCartItemVariant(item.selectedVariant)}` : ''}
  Quantity: ${item.quantity} × ${money(item.unitPrice)} = ${money(item.totalPrice)}
`).join('')}

Order Total: ${money(order.total)}

Track your order: ${orderUrl}

Shipping Address:
${address.firstName} ${address.lastName}
${address.address1}
${address.city}, ${address.state} ${address.postalCode}

${order.type === 'commission' ? 'This is a custom commission order. I will contact you within 24-48 hours to discuss details.' : ''}

Thank you for supporting independent art!
`;

    return { subject, html, text };
  }

  static generateShippingEmail(order: Order, brand: EmailBrand): EmailTemplate {
    const customerName = this.customerName(order);
    const orderUrl = absoluteUrl(createOrderTrackingPath(order.id), brand.siteUrl);
    const packageTrackingUrl = trackingUrl(order.shippingCarrier, order.trackingNumber) || orderUrl;
    const subject = `Your order ${order.orderNumber} has shipped`;

    const sections: EmailSection[] = [];
    if (order.trackingNumber) {
      sections.push({
        heading: 'Tracking number',
        html: `<p style="margin:0;font-size:22px;font-weight:600;letter-spacing:0.02em;color:${normalizeEmailColor(brand.primaryColor)};">${escapeHtml(order.trackingNumber)}</p>`,
      });
    }
    if (order.estimatedDelivery) {
      sections.push({ html: emailDetailRows([['Estimated delivery', escapeHtml(new Date(order.estimatedDelivery).toLocaleDateString())]]) });
    }

    const html = orderEmailHtml(brand, {
      title: 'Your order has shipped',
      intro: `Order ${escapeHtml(order.orderNumber)} is on its way, ${escapeHtml(customerName)}. Your artwork has been carefully packaged.`,
      sections,
      cta: { label: order.trackingNumber ? 'Track package' : 'View order status', href: packageTrackingUrl },
      closing: `We'll let you know when it's delivered. <a href="${escapeHtml(orderUrl)}" style="color:#374151;">View your full order status</a>.`,
    });

    const text = `
Your order ${order.orderNumber} has shipped!

${order.trackingNumber ? `Tracking Number: ${order.trackingNumber}\nTrack package: ${packageTrackingUrl}` : ''}
${order.estimatedDelivery ? `Estimated Delivery: ${new Date(order.estimatedDelivery).toLocaleDateString()}` : ''}

View full order status: ${orderUrl}

Your artwork has been carefully packaged and is on its way to you!
`;

    return { subject, html, text };
  }

  static generateDeliveryEmail(order: Order, brand: EmailBrand): EmailTemplate {
    const customerName = this.customerName(order);
    const orderUrl = absoluteUrl(createOrderTrackingPath(order.id), brand.siteUrl);
    const shopUrl = absoluteUrl('/shop', brand.siteUrl);
    const subject = `Your order ${order.orderNumber} has been delivered`;

    const html = orderEmailHtml(brand, {
      title: 'Your order has been delivered',
      intro: `Order ${escapeHtml(order.orderNumber)} is now with you, ${escapeHtml(customerName)}. I hope you love your new piece.`,
      sections: [{
        heading: 'Share it',
        html: "I'd love to see your artwork in its new home — share a photo and tag the studio on social media.",
      }],
      cta: { label: 'View order', href: orderUrl },
      closing: `Thank you for supporting independent art. <a href="${escapeHtml(shopUrl)}" style="color:#374151;">Browse more work in the shop</a>.`,
    });

    const text = `
Your order ${order.orderNumber} has been delivered!

Your artwork has been successfully delivered! We hope you love your new piece.

View your order: ${orderUrl}

Thank you for supporting independent art.
`;

    return { subject, html, text };
  }

  static generateRefundEmail(order: Order, brand: EmailBrand): EmailTemplate {
    const customerName = this.customerName(order);
    const orderUrl = absoluteUrl(createOrderTrackingPath(order.id), brand.siteUrl);
    const subject = `Refund issued for order ${order.orderNumber}`;

    const html = orderEmailHtml(brand, {
      title: 'Refund issued',
      intro: `Hello ${escapeHtml(customerName)}, a refund of <strong>${money(order.total)} ${escapeHtml(order.currency)}</strong> has been issued for order ${escapeHtml(order.orderNumber)}.`,
      sections: [{ html: 'Depending on your payment method, it may take several business days to appear on your statement.' }],
      cta: { label: 'View order details', href: orderUrl },
      closing: 'If you have questions, reply to this email or contact the studio.',
    });

    const text = `
Refund issued for order ${order.orderNumber}

Hello ${customerName},

A refund of ${money(order.total)} ${order.currency} has been issued for your order.
It may take several business days to appear on your statement.

View order details: ${orderUrl}
`;

    return { subject, html, text };
  }

  static getEmailForStatus(order: Order, status: OrderStatus, brand: EmailBrand): EmailTemplate | null {
    switch (status) {
      case 'confirmed':
        return this.generateConfirmationEmail(order, brand);
      case 'shipped':
        return this.generateShippingEmail(order, brand);
      case 'delivered':
        return this.generateDeliveryEmail(order, brand);
      case 'refunded':
        return this.generateRefundEmail(order, brand);
      default:
        return null;
    }
  }

  static async sendStatusUpdate(order: Order, newStatus: OrderStatus): Promise<boolean> {
    const template = this.getEmailForStatus(order, newStatus, await getEmailBrand());
    if (!template) {
      return false;
    }
    return sendTemplateEmail(order.customerEmail, template);
  }
}
