import 'server-only';
import { revalidateTag } from 'next/cache';
import { db } from '@/lib/db';
import { getAllProducts, getProductById } from '@/lib/commerce-server';
import { productImageSrc } from '@/lib/commerce';
import { InventoryService } from '@/lib/inventory';
import { OrderManager } from '@/lib/orders';
import {
  brandedEmailHtml,
  emailDetailRows,
  getEmailBrand,
  getEmailDeliveryStatus,
  sendTemplateEmail,
} from '@/lib/email';
import {
  listMarketEventContacts,
  normalizeSubscriberEmail,
  tagProfileWithMarketEvent,
} from '@/lib/newsletter-subscribers';
import {
  computeMarketSummary,
  marketPaymentMethodLabel,
  normalizePriceSheetConfig,
  slugifyMarketCampaign,
  type MarketBookkeepingSummary,
  type MarketPaymentMethod,
  type MarketSaleLedgerEntry,
  type PriceSheetConfig,
} from '@/lib/market-qr';

export interface MarketEventRecord {
  id: string;
  slug: string;
  name: string;
  location: string | null;
  startDate: string;
  endDate: string | null;
  boothFee: number;
  otherExpenses: number;
  salesTaxRate: number;
  promoCode: string | null;
  followUpEnabled: boolean;
  followUpDelayDays: number;
  followUpSubject: string | null;
  followUpBody: string | null;
  followUpSentAt: string | null;
  priceSheetConfig: PriceSheetConfig;
  notes: string | null;
  contactCount: number;
  summary: MarketBookkeepingSummary;
}

export interface MarketProductTile {
  id: string;
  slug: string;
  title: string;
  price: number;
  category: string;
  medium: string;
  dimensions: string;
  availability: string;
  imageUrl: string;
  trackedStock: number | null;
  availableStock: number | null;
}

function roundMoney(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function findMarketEventBySlug(slug?: string | null) {
  const clean = slug?.trim() ? slugifyMarketCampaign(slug) : '';
  if (!clean) return null;
  return db.marketEvent.findUnique({ where: { slug: clean } }).catch(() => null);
}

async function generateUniqueMarketSlug(name: string, excludeId?: string): Promise<string> {
  const base = slugifyMarketCampaign(name);
  let candidate = base;
  let counter = 2;
  while (true) {
    const existing = await db.marketEvent.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!existing || existing.id === excludeId) return candidate;
    candidate = `${base}-${counter}`;
    counter += 1;
  }
}

function toLedgerEntry(
  order: {
    id: string;
    orderNumber: string;
    createdAt: Date;
    paymentMethod: string | null;
    status: string;
    subtotal: number;
    tax: number;
    total: number;
    userEmail: string;
    marketEvent?: { name: string } | null;
    items: Array<{ productTitle: string; quantity: number }>;
  },
): MarketSaleLedgerEntry {
  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const itemsSummary = order.items
    .map((item) => (item.quantity > 1 ? `${item.quantity}x ${item.productTitle}` : item.productTitle))
    .join(', ');
  const buyerEmail = order.userEmail.endsWith('.local') ? '' : order.userEmail;

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    createdAt: order.createdAt.toISOString(),
    eventName: order.marketEvent?.name || 'General Market',
    paymentMethod: order.paymentMethod || 'other',
    status: order.status,
    subtotal: order.subtotal,
    tax: order.tax,
    total: order.total,
    itemCount,
    itemsSummary: itemsSummary || 'In-person sale',
    buyerEmail,
  };
}

export async function getMarketWorkspaceData(eventId?: string | null) {
  const [events, allOrders, products, inventories] = await Promise.all([
    db.marketEvent.findMany({ orderBy: { startDate: 'desc' } }),
    db.order.findMany({
      where: {
        OR: [{ type: 'in_person' }, { marketEventId: { not: null } }],
      },
      include: {
        items: { select: { productTitle: true, quantity: true } },
        marketEvent: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    }),
    getAllProducts(),
    db.productInventory.findMany({
      select: { productId: true, currentStock: true, availableStock: true, isTrackingEnabled: true },
    }),
  ]);

  const inventoryMap = new Map(inventories.map((inv) => [inv.productId, inv]));

  const contactCounts = await Promise.all(
    events.map(async (ev) => {
      const contacts = await listMarketEventContacts(ev.slug);
      return [ev.id, contacts.length] as const;
    }),
  );
  const contactCountById = new Map(contactCounts);

  const eventRecords: MarketEventRecord[] = events.map((ev) => {
    const evOrders = allOrders.filter((o) => o.marketEventId === ev.id);
    const summary = computeMarketSummary(
      evOrders.map((o) => ({
        status: o.status,
        paymentMethod: o.paymentMethod,
        subtotal: o.subtotal,
        tax: o.tax,
        total: o.total,
        itemCount: o.items.reduce((sum, item) => sum + item.quantity, 0),
      })),
      { boothFee: ev.boothFee, otherExpenses: ev.otherExpenses },
    );

    return {
      id: ev.id,
      slug: ev.slug,
      name: ev.name,
      location: ev.location,
      startDate: ev.startDate.toISOString(),
      endDate: ev.endDate ? ev.endDate.toISOString() : null,
      boothFee: ev.boothFee,
      otherExpenses: ev.otherExpenses,
      salesTaxRate: ev.salesTaxRate,
      promoCode: ev.promoCode,
      followUpEnabled: ev.followUpEnabled,
      followUpDelayDays: ev.followUpDelayDays,
      followUpSubject: ev.followUpSubject,
      followUpBody: ev.followUpBody,
      followUpSentAt: ev.followUpSentAt ? ev.followUpSentAt.toISOString() : null,
      priceSheetConfig: normalizePriceSheetConfig(ev.priceSheetConfig),
      notes: ev.notes,
      contactCount: contactCountById.get(ev.id) ?? 0,
      summary,
    };
  });

  const filteredOrders = eventId
    ? allOrders.filter((o) => o.marketEventId === eventId)
    : allOrders;

  const totalBoothFees = eventId
    ? (events.find((e) => e.id === eventId)?.boothFee ?? 0)
    : events.reduce((sum, e) => sum + e.boothFee, 0);
  const totalOtherExpenses = eventId
    ? (events.find((e) => e.id === eventId)?.otherExpenses ?? 0)
    : events.reduce((sum, e) => sum + e.otherExpenses, 0);

  const overallSummary = computeMarketSummary(
    filteredOrders.map((o) => ({
      status: o.status,
      paymentMethod: o.paymentMethod,
      subtotal: o.subtotal,
      tax: o.tax,
      total: o.total,
      itemCount: o.items.reduce((sum, item) => sum + item.quantity, 0),
    })),
    { boothFee: totalBoothFees, otherExpenses: totalOtherExpenses },
  );

  const sales = filteredOrders.map(toLedgerEntry);

  const productTiles: MarketProductTile[] = products.map((product) => {
    const inv = inventoryMap.get(product.id);
    const tracked = inv && inv.isTrackingEnabled ? inv : null;
    return {
      id: product.id,
      slug: product.slug ?? product.id,
      title: product.title,
      price: product.price,
      category: product.category,
      medium: product.medium,
      dimensions: product.dimensions,
      availability: product.availability,
      imageUrl: productImageSrc(product),
      trackedStock: tracked ? tracked.currentStock : null,
      availableStock: tracked ? tracked.availableStock : null,
    };
  });

  const brand = await getEmailBrand().catch(() => null);

  return {
    siteName: brand?.siteName || 'The Studio',
    events: eventRecords,
    sales,
    summary: overallSummary,
    products: productTiles,
  };
}

export async function createMarketEvent(input: {
  name: string;
  location?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  boothFee?: number;
  otherExpenses?: number;
  salesTaxRate?: number;
  promoCode?: string | null;
  notes?: string | null;
  followUpEnabled?: boolean;
  followUpDelayDays?: number;
  followUpSubject?: string | null;
  followUpBody?: string | null;
}) {
  const name = input.name.trim().slice(0, 100);
  if (!name) throw new Error('Event name is required.');

  const slug = await generateUniqueMarketSlug(name);
  const startDate = input.startDate ? new Date(input.startDate) : new Date();
  const endDate = input.endDate ? new Date(input.endDate) : null;

  return db.marketEvent.create({
    data: {
      slug,
      name,
      location: input.location?.trim().slice(0, 140) || null,
      startDate: Number.isNaN(startDate.getTime()) ? new Date() : startDate,
      endDate: endDate && !Number.isNaN(endDate.getTime()) ? endDate : null,
      boothFee: Math.max(0, roundMoney(Number(input.boothFee) || 0)),
      otherExpenses: Math.max(0, roundMoney(Number(input.otherExpenses) || 0)),
      salesTaxRate: Math.max(0, Math.min(25, roundMoney(Number(input.salesTaxRate) || 0))),
      promoCode: input.promoCode?.trim().toUpperCase().slice(0, 40) || null,
      notes: input.notes?.trim().slice(0, 1000) || null,
      followUpEnabled: typeof input.followUpEnabled === 'boolean' ? input.followUpEnabled : true,
      followUpDelayDays: Math.max(0, Math.min(14, Math.round(Number(input.followUpDelayDays) || 1))),
      followUpSubject: input.followUpSubject?.trim().slice(0, 160) || null,
      followUpBody: input.followUpBody?.trim().slice(0, 2000) || null,
    },
  });
}

export async function updateMarketEvent(
  id: string,
  input: {
    name?: string;
    location?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    boothFee?: number;
    otherExpenses?: number;
    salesTaxRate?: number;
    promoCode?: string | null;
    followUpEnabled?: boolean;
    followUpDelayDays?: number;
    followUpSubject?: string | null;
    followUpBody?: string | null;
    priceSheetConfig?: unknown;
    notes?: string | null;
  },
) {
  const existing = await db.marketEvent.findUnique({ where: { id } });
  if (!existing) throw new Error('Market event not found.');

  const data: Record<string, unknown> = {};
  if (typeof input.name === 'string' && input.name.trim()) {
    data.name = input.name.trim().slice(0, 100);
  }
  if (input.location !== undefined) {
    data.location = input.location?.trim().slice(0, 140) || null;
  }
  if (input.startDate !== undefined && input.startDate) {
    const parsed = new Date(input.startDate);
    if (!Number.isNaN(parsed.getTime())) data.startDate = parsed;
  }
  if (input.endDate !== undefined) {
    if (!input.endDate) {
      data.endDate = null;
    } else {
      const parsed = new Date(input.endDate);
      if (!Number.isNaN(parsed.getTime())) data.endDate = parsed;
    }
  }
  if (input.boothFee !== undefined) {
    data.boothFee = Math.max(0, roundMoney(Number(input.boothFee) || 0));
  }
  if (input.otherExpenses !== undefined) {
    data.otherExpenses = Math.max(0, roundMoney(Number(input.otherExpenses) || 0));
  }
  if (input.salesTaxRate !== undefined) {
    data.salesTaxRate = Math.max(0, Math.min(25, roundMoney(Number(input.salesTaxRate) || 0)));
  }
  if (input.promoCode !== undefined) {
    data.promoCode = input.promoCode?.trim().toUpperCase().slice(0, 40) || null;
  }
  if (typeof input.followUpEnabled === 'boolean') {
    data.followUpEnabled = input.followUpEnabled;
  }
  if (input.followUpDelayDays !== undefined) {
    data.followUpDelayDays = Math.max(0, Math.min(14, Math.round(Number(input.followUpDelayDays) || 1)));
  }
  if (input.followUpSubject !== undefined) {
    data.followUpSubject = input.followUpSubject?.trim().slice(0, 160) || null;
  }
  if (input.followUpBody !== undefined) {
    data.followUpBody = input.followUpBody?.trim().slice(0, 2000) || null;
  }
  if (input.priceSheetConfig !== undefined) {
    data.priceSheetConfig = normalizePriceSheetConfig(input.priceSheetConfig);
  }
  if (input.notes !== undefined) {
    data.notes = input.notes?.trim().slice(0, 1000) || null;
  }

  return db.marketEvent.update({ where: { id }, data });
}

export async function deleteMarketEvent(id: string) {
  return db.marketEvent.delete({ where: { id } });
}

export interface RecordInPersonSaleInput {
  marketEventId?: string | null;
  paymentMethod: MarketPaymentMethod;
  items: Array<{
    productId?: string | null;
    title?: string;
    quantity: number;
    unitPrice?: number;
  }>;
  discountAmount?: number;
  taxRate?: number;
  taxIncluded?: boolean;
  buyerEmail?: string | null;
  buyerName?: string | null;
  subscribeToFollowUp?: boolean;
  sendReceipt?: boolean;
  notes?: string | null;
}

/** Record an in-person booth sale, sync inventory, tag collector, and optionally email a receipt. */
export async function recordInPersonSale(input: RecordInPersonSaleInput) {
  if (!Array.isArray(input.items) || input.items.length === 0) {
    throw new Error('Add at least one item to record a sale.');
  }

  const event = input.marketEventId
    ? await db.marketEvent.findUnique({ where: { id: input.marketEventId } })
    : null;

  const resolvedLines: Array<{
    productId: string;
    isCatalogProduct: boolean;
    title: string;
    image: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }> = [];

  for (const rawLine of input.items) {
    const qty = Math.max(1, Math.min(99, Math.floor(Number(rawLine.quantity) || 1)));
    if (rawLine.productId && !rawLine.productId.startsWith('custom:')) {
      const product = await getProductById(rawLine.productId);
      if (!product) {
        throw new Error(`Product not found: ${rawLine.productId}`);
      }
      const unitPrice =
        typeof rawLine.unitPrice === 'number' && Number.isFinite(rawLine.unitPrice) && rawLine.unitPrice >= 0
          ? roundMoney(rawLine.unitPrice)
          : roundMoney(product.price);
      resolvedLines.push({
        productId: product.id,
        isCatalogProduct: true,
        title: product.title,
        image: productImageSrc(product),
        quantity: qty,
        unitPrice,
        totalPrice: roundMoney(unitPrice * qty),
      });
    } else {
      const title = (rawLine.title || '').trim().slice(0, 120) || 'Custom market item';
      const unitPrice = Math.max(0, roundMoney(Number(rawLine.unitPrice) || 0));
      resolvedLines.push({
        productId: `custom:${crypto.randomUUID().slice(0, 8)}`,
        isCatalogProduct: false,
        title,
        image: '',
        quantity: qty,
        unitPrice,
        totalPrice: roundMoney(unitPrice * qty),
      });
    }
  }

  const rawSubtotal = roundMoney(resolvedLines.reduce((sum, line) => sum + line.totalPrice, 0));
  const discount = Math.min(rawSubtotal, Math.max(0, roundMoney(Number(input.discountAmount) || 0)));
  const discountedAmount = roundMoney(rawSubtotal - discount);
  const taxRate = Math.max(0, Math.min(25, Number(input.taxRate ?? event?.salesTaxRate ?? 0) || 0));

  let subtotal = discountedAmount;
  let tax = 0;
  let total = discountedAmount;

  if (taxRate > 0) {
    if (input.taxIncluded) {
      subtotal = roundMoney(discountedAmount / (1 + taxRate / 100));
      tax = roundMoney(discountedAmount - subtotal);
      total = discountedAmount;
    } else {
      subtotal = discountedAmount;
      tax = roundMoney(discountedAmount * (taxRate / 100));
      total = roundMoney(subtotal + tax);
    }
  }

  const normalizedEmail = normalizeSubscriberEmail(input.buyerEmail);
  const orderEmail = normalizedEmail || 'walkin@market.local';
  const orderNumber = OrderManager.generateOrderNumber();
  const orderId = crypto.randomUUID();
  const paymentLabel = marketPaymentMethodLabel(input.paymentMethod);

  let userId: string | null = null;
  if (normalizedEmail) {
    const existingUser = await db.user.findUnique({ where: { email: normalizedEmail }, select: { id: true } });
    if (existingUser) {
      userId = existingUser.id;
    } else {
      const createdUser = await db.user.create({
        data: {
          email: normalizedEmail,
          name: input.buyerName?.trim().slice(0, 100) || undefined,
          firstName: input.buyerName?.trim().split(/\s+/)[0]?.slice(0, 60) || undefined,
        },
        select: { id: true },
      });
      userId = createdUser.id;
    }
  }

  const createdOrder = await db.order.create({
    data: {
      id: orderId,
      orderNumber,
      userId,
      userEmail: orderEmail,
      status: 'delivered',
      type: 'in_person',
      subtotal,
      shipping: 0,
      tax,
      total,
      currency: 'USD',
      paymentStatus: 'paid',
      paymentMethod: input.paymentMethod,
      marketEventId: event?.id ?? null,
      specialInstructions: [
        event ? `Market: ${event.name}` : 'In-person market sale',
        discount > 0 ? `Discount: $${discount.toFixed(2)}` : null,
        input.notes?.trim() ? input.notes.trim().slice(0, 400) : null,
      ]
        .filter(Boolean)
        .join(' · '),
      items: {
        create: resolvedLines.map((line) => ({
          id: crypto.randomUUID(),
          productId: line.productId,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          totalPrice: line.totalPrice,
          productTitle: line.title,
          productImage: line.image,
        })),
      },
      timeline: {
        create: [
          {
            id: crypto.randomUUID(),
            status: 'delivered',
            message: `In-person sale recorded (${paymentLabel})`,
            details: event ? `Sold at ${event.name}` : 'Sold in person at market',
            timestamp: new Date(),
          },
        ],
      },
    },
    include: {
      items: { select: { productTitle: true, quantity: true } },
      marketEvent: { select: { id: true, name: true } },
    },
  });

  // Sync inventory immediately so online buyers cannot purchase items sold at the booth.
  for (const line of resolvedLines) {
    if (!line.isCatalogProduct) continue;
    const inv = await db.productInventory.findUnique({ where: { productId: line.productId } });
    if (inv && inv.isTrackingEnabled) {
      const deductQty = Math.min(inv.currentStock, line.quantity);
      if (deductQty > 0) {
        await InventoryService.recordStockMovement({
          productId: line.productId,
          type: 'sale',
          quantity: -deductQty,
          orderId: createdOrder.id,
          reason: event ? `In-person sale at ${event.name}` : 'In-person market sale',
        }).catch((err) => {
          console.error('Failed to deduct stock for in-person sale:', err);
        });
      }
    } else {
      // Untracked 1-of-1 original artwork: mark sold immediately when sold at booth.
      const updated = await db.product.updateMany({
        where: { id: line.productId, availability: 'available' },
        data: { availability: 'sold' },
      });
      if (updated.count > 0) revalidateTag('products');
    }
  }

  // Tag buyer profile for post-market follow-up and collector analytics.
  if (normalizedEmail) {
    const tagSlug = event?.slug || 'market';
    await tagProfileWithMarketEvent(normalizedEmail, tagSlug, {
      subscribeNewsletter: input.subscribeToFollowUp === true,
      firstName: input.buyerName,
    }).catch(() => undefined);
  }

  let receiptSent = false;
  if (normalizedEmail && input.sendReceipt !== false) {
    const delivery = await getEmailDeliveryStatus();
    if (delivery.mode === 'smtp') {
      const brand = await getEmailBrand();
      const itemRows: Array<[string, string]> = resolvedLines.map((line) => [
        line.quantity > 1 ? `${line.quantity} × ${line.title}` : line.title,
        `$${line.totalPrice.toFixed(2)}`,
      ]);
      if (discount > 0) itemRows.push(['Discount', `-$${discount.toFixed(2)}`]);
      if (tax > 0) itemRows.push(['Sales tax', `$${tax.toFixed(2)}`]);
      itemRows.push(['Total paid', `$${total.toFixed(2)} (${paymentLabel})`]);

      const html = brandedEmailHtml(brand, {
        title: `Thank you for visiting ${brand.siteName}`,
        intro: event
          ? `Here is your studio receipt from <strong>${escapeHtml(event.name)}</strong> (Order ${escapeHtml(orderNumber)}).`
          : `Here is your in-person studio receipt (Order ${escapeHtml(orderNumber)}).`,
        sections: [
          {
            heading: 'Items',
            html: emailDetailRows(itemRows),
          },
        ],
        cta: { label: 'Visit the online shop', href: `${brand.siteUrl}/shop` },
        closing: 'I would love to see your artwork in its new home. Reply to this email anytime with questions or care notes.',
      });

      const text = [
        `Receipt from ${brand.siteName} (${orderNumber})`,
        event ? `Event: ${event.name}` : null,
        '',
        ...resolvedLines.map((l) => `- ${l.quantity} x ${l.title}: $${l.totalPrice.toFixed(2)}`),
        tax > 0 ? `Tax: $${tax.toFixed(2)}` : null,
        `Total paid: $${total.toFixed(2)} (${paymentLabel})`,
      ]
        .filter(Boolean)
        .join('\n');

      receiptSent = await sendTemplateEmail(normalizedEmail, {
        subject: `Receipt from ${brand.siteName}: ${orderNumber}`,
        html,
        text,
      }).catch(() => false);
    }
  }

  return {
    sale: toLedgerEntry(createdOrder),
    receiptSent,
  };
}

/** Void/undo an in-person sale and cleanly restore any deducted inventory. */
export async function voidInPersonSale(orderId: string) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });
  if (!order) throw new Error('Sale not found.');
  if (order.type !== 'in_person') {
    throw new Error('Only in-person market sales can be voided from Market Mode.');
  }
  if (order.status === 'cancelled' || order.status === 'refunded') {
    return { voided: false, orderId };
  }

  await db.order.update({
    where: { id: orderId },
    data: {
      status: 'cancelled',
      paymentStatus: 'refunded',
      timeline: {
        create: {
          id: crypto.randomUUID(),
          status: 'cancelled',
          message: 'In-person sale voided',
          details: 'Voided from Studio Market Mode and stock restored',
          timestamp: new Date(),
        },
      },
    },
  });

  // Restore inventory for catalog items
  for (const item of order.items) {
    if (item.productId.startsWith('custom:')) continue;
    const inv = await db.productInventory.findUnique({ where: { productId: item.productId } });
    if (inv && inv.isTrackingEnabled) {
      await InventoryService.recordStockMovement({
        productId: item.productId,
        type: 'return',
        quantity: item.quantity,
        orderId: order.id,
        reason: 'In-person sale voided from Market Mode',
      }).catch((err) => {
        console.error('Failed to restore stock on void:', err);
      });
    } else {
      const updated = await db.product.updateMany({
        where: { id: item.productId, availability: 'sold' },
        data: { availability: 'available' },
      });
      if (updated.count > 0) revalidateTag('products');
    }
  }

  return { voided: true, orderId };
}

/** Send (or resume) the post-market follow-up email for a specific MarketEvent idempotently. */
export async function sendMarketEventFollowup(eventId: string, options?: { force?: boolean }) {
  const event = await db.marketEvent.findUnique({ where: { id: eventId } });
  if (!event) throw new Error('Market event not found.');

  const delivery = await getEmailDeliveryStatus();
  if (delivery.mode !== 'smtp') {
    return {
      attempted: 0,
      sent: 0,
      failed: 0,
      skippedReason: 'Email delivery is currently off. Configure SMTP in Settings to send follow-ups.',
    };
  }

  const contacts = await listMarketEventContacts(event.slug);
  if (contacts.length === 0) {
    return { attempted: 0, sent: 0, failed: 0, skippedReason: 'No contacts tagged for this market yet.' };
  }

  const campaignId = `market-followup-${event.id}`;
  await db.emailCampaign.upsert({
    where: { id: campaignId },
    create: {
      id: campaignId,
      name: `Market Follow-up: ${event.name}`,
      type: 'automated',
      templateId: 'market-followup',
      segments: JSON.stringify([`market:${event.slug}`]),
      metrics: JSON.stringify({ sent: 0 }),
      status: 'active',
    },
    update: {},
  });

  const alreadySentRows = await db.emailCampaignDelivery.findMany({
    where: { campaignId, status: 'sent' },
    select: { email: true },
  });
  const alreadySent = new Set(alreadySentRows.map((row) => row.email.toLowerCase()));
  const recipients = options?.force
    ? contacts.filter((c) => !alreadySent.has(c.email))
    : contacts.filter((c) => !alreadySent.has(c.email));

  if (recipients.length === 0) {
    return { attempted: 0, sent: 0, failed: 0, skippedReason: 'All tagged visitors have already received this follow-up.' };
  }

  const [brand, products] = await Promise.all([getEmailBrand(), getAllProducts()]);
  const availableWorks = products
    .filter((p) => p.availability === 'available')
    .sort((a, b) => Number(b.featured) - Number(a.featured))
    .slice(0, 4);

  const subject =
    event.followUpSubject?.trim() ||
    `Thank you for stopping by at ${event.name}`;
  const rawBody =
    event.followUpBody?.trim() ||
    `It was wonderful meeting you at ${event.name}. If a piece caught your eye, or if you want to browse what is still available in the studio, you can view the online shop anytime.`;

  const promoBlock = event.promoCode
    ? `<div style="margin:18px 0;padding:14px 18px;border:1px solid #e5e7eb;border-radius:8px;background:#f9fafb;text-align:center;">
         <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#6b7280;">Market Thank-You Code</div>
         <div style="margin-top:4px;font-size:20px;font-weight:700;letter-spacing:0.08em;color:#111827;">${escapeHtml(event.promoCode)}</div>
         <div style="margin-top:4px;font-size:13px;color:#4b5563;">Enter this code at checkout on ${escapeHtml(brand.siteName)}.</div>
       </div>`
    : '';

  const worksHtml =
    availableWorks.length > 0
      ? availableWorks
          .map((work) => {
            const href = `${brand.siteUrl}/shop/${encodeURIComponent(work.slug ?? work.id)}?utm_source=market&utm_medium=followup&utm_campaign=${encodeURIComponent(event.slug)}`;
            return `<div style="padding:10px 0;border-bottom:1px solid #f3f4f6;">
              <a href="${href}" style="color:#111827;font-weight:600;text-decoration:none;">${escapeHtml(work.title)}</a>
              <span style="color:#6b7280;font-size:13px;"> · $${work.price.toFixed(0)}</span>
              ${work.medium ? `<div style="font-size:12px;color:#6b7280;">${escapeHtml([work.medium, work.dimensions].filter(Boolean).join(' · '))}</div>` : ''}
            </div>`;
          })
          .join('')
      : '';

  let sent = 0;
  let failed = 0;

  for (const recipient of recipients) {
    const greeting = recipient.firstName ? `Hi ${escapeHtml(recipient.firstName)},` : 'Hello,';
    const html = brandedEmailHtml(brand, {
      title: subject,
      intro: `${greeting}<br><br>${escapeHtml(rawBody).replace(/\n/g, '<br>')}`,
      sections: [
        ...(promoBlock ? [{ html: promoBlock }] : []),
        ...(worksHtml ? [{ heading: 'Still available in the studio', html: worksHtml }] : []),
      ],
      cta: {
        label: 'Browse available works',
        href: `${brand.siteUrl}/shop?utm_source=market&utm_medium=followup&utm_campaign=${encodeURIComponent(event.slug)}`,
      },
      closing: 'Reply anytime if you have questions about a work or custom commission.',
    });

    const text = [
      recipient.firstName ? `Hi ${recipient.firstName},` : 'Hello,',
      '',
      rawBody,
      event.promoCode ? `\nMarket code: ${event.promoCode}` : '',
      `\nBrowse available works: ${brand.siteUrl}/shop`,
    ].join('\n');

    const ok = await sendTemplateEmail(recipient.email, { subject, html, text }).catch(() => false);
    if (ok) sent += 1;
    else failed += 1;

    await db.emailCampaignDelivery
      .upsert({
        where: { campaignId_email: { campaignId, email: recipient.email } },
        create: { campaignId, email: recipient.email, status: ok ? 'sent' : 'failed' },
        update: { status: ok ? 'sent' : 'failed', attemptedAt: new Date() },
      })
      .catch(() => undefined);
  }

  if (sent > 0) {
    await db.marketEvent.update({
      where: { id: event.id },
      data: { followUpSentAt: new Date() },
    });
  }

  return { attempted: recipients.length, sent, failed };
}

/** Runs scheduled post-market follow-up emails for any due MarketEvents. */
export async function processDueMarketFollowups(now = new Date()) {
  const delivery = await getEmailDeliveryStatus();
  if (delivery.mode !== 'smtp') {
    return { attempted: 0, sent: 0, failed: 0 };
  }

  const events = await db.marketEvent.findMany({
    where: { followUpEnabled: true },
  });

  let attempted = 0;
  let sent = 0;
  let failed = 0;
  const dayMs = 24 * 60 * 60 * 1000;

  for (const event of events) {
    const anchor = event.endDate ?? event.startDate;
    const dueAt = anchor.getTime() + Math.max(0, event.followUpDelayDays) * dayMs;
    const maxWindowMs = 14 * dayMs;
    if (now.getTime() < dueAt || now.getTime() > dueAt + maxWindowMs) continue;

    const result = await sendMarketEventFollowup(event.id);
    attempted += result.attempted;
    sent += result.sent;
    failed += result.failed;
  }

  return { attempted, sent, failed };
}
