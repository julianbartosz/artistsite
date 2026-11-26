import 'server-only';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { getConfig } from '@/lib/config';
import { InventoryService } from '@/lib/inventory';
import { productImageSrc } from '@/lib/commerce';
import { brandedEmailHtml, getEmailBrand, getEmailDeliveryStatus, sendTemplateEmail } from '@/lib/email';
import { escapeHtml } from '@/lib/email-shell';
import {
  clampInt,
  type ConsignmentRecord,
  type ConsignmentStatus,
} from '@/lib/jobs-shared';

function normalizeConsignmentStatus(raw: unknown): ConsignmentStatus {
  if (raw === 'sold' || raw === 'returned' || raw === 'out') return raw;
  return 'out';
}

function normalizeProductImage(images: unknown): string {
  if (!images || typeof images !== 'object') return '';
  const raw = images as { thumbnail?: string; gallery?: string[] };
  return productImageSrc({
    images: {
      thumbnail: raw.thumbnail ?? '',
      gallery: Array.isArray(raw.gallery) ? raw.gallery : [],
    },
  });
}

function roundMoney(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

export async function listConsignments(): Promise<ConsignmentRecord[]> {
  const rows = await db.consignmentPlacement.findMany({
    orderBy: [{ status: 'asc' }, { returnDueAt: 'asc' }, { placedAt: 'desc' }],
  });
  if (rows.length === 0) return [];

  const productIds = Array.from(new Set(rows.map((r) => r.productId)));
  const products = await db.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, title: true, images: true },
  });
  const productMap = new Map(products.map((p) => [p.id, p]));

  return rows.map((row) => {
    const product = productMap.get(row.productId);
    const split = clampInt(row.artistSplitPercent, 0, 100, 60);
    return {
      id: row.id,
      productId: row.productId,
      productTitle: product?.title ?? row.productId,
      productImage: product ? normalizeProductImage(product.images) : '',
      venueName: row.venueName,
      contactName: row.contactName,
      contactEmail: row.contactEmail,
      quantity: row.quantity,
      askingPrice: row.askingPrice,
      artistSplitPercent: split,
      artistPayout: roundMoney(row.askingPrice * row.quantity * (split / 100)),
      status: normalizeConsignmentStatus(row.status),
      placedAt: row.placedAt.toISOString(),
      returnDueAt: row.returnDueAt ? row.returnDueAt.toISOString() : null,
      closedAt: row.closedAt ? row.closedAt.toISOString() : null,
      reminderSentAt: row.reminderSentAt ? row.reminderSentAt.toISOString() : null,
      notes: row.notes,
    };
  });
}

export async function createConsignment(
  input: {
    productId: string;
    venueName: string;
    contactName?: string | null;
    contactEmail?: string | null;
    quantity?: number;
    askingPrice?: number;
    artistSplitPercent?: number;
    placedAt?: string | null;
    returnDueAt?: string | null;
    notes?: string | null;
  },
  adminUserId?: string,
): Promise<ConsignmentRecord> {
  const venueName = input.venueName.trim().slice(0, 120);
  if (!venueName) throw new Error('Venue name is required.');

  const product = await db.product.findUnique({ where: { id: input.productId } });
  if (!product) throw new Error('Product not found.');

  const quantity = clampInt(input.quantity, 1, 99, 1);
  const askingPrice = Math.max(0, roundMoney(input.askingPrice ?? product.price));
  const artistSplitPercent = clampInt(input.artistSplitPercent, 0, 100, 60);
  const placedAt = input.placedAt ? new Date(input.placedAt) : new Date();
  const returnDueAt = input.returnDueAt ? new Date(input.returnDueAt) : null;

  const created = await db.consignmentPlacement.create({
    data: {
      productId: product.id,
      venueName,
      contactName: input.contactName?.trim().slice(0, 100) || null,
      contactEmail: input.contactEmail?.trim().slice(0, 160) || null,
      quantity,
      askingPrice,
      artistSplitPercent,
      status: 'out',
      placedAt: Number.isNaN(placedAt.getTime()) ? new Date() : placedAt,
      returnDueAt: returnDueAt && !Number.isNaN(returnDueAt.getTime()) ? returnDueAt : null,
      notes: input.notes?.trim().slice(0, 1000) || null,
    },
  });

  // Deduct consigned stock via standard inventory transfer so it is not double-sold online.
  const inventory = await InventoryService.getInventoryStatus(product.id);
  if (inventory && inventory.currentStock > 0) {
    const deduct = Math.min(inventory.currentStock, quantity);
    await InventoryService.recordStockMovement({
      productId: product.id,
      type: 'transfer',
      quantity: -deduct,
      userId: adminUserId,
      reason: `Consigned to ${venueName}`,
      notes: `Consignment placement ${created.id}`,
    }).catch(() => undefined);
    // Keep zero-stock consigned works marked "reserved" instead of falsely "sold".
    const remaining = Math.max(0, inventory.availableStock - deduct);
    if (remaining <= 0) {
      await db.product.updateMany({
        where: { id: product.id, availability: { in: ['available', 'sold'] } },
        data: { availability: 'reserved' },
      }).catch(() => undefined);
    }
  } else if (!inventory && product.availability === 'available') {
    await db.product.update({
      where: { id: product.id },
      data: { availability: 'reserved' },
    }).catch(() => undefined);
  }
  try { revalidatePath('/shop'); } catch { /* ignore outside request */ }

  return {
    id: created.id,
    productId: product.id,
    productTitle: product.title,
    productImage: normalizeProductImage(product.images),
    venueName: created.venueName,
    contactName: created.contactName,
    contactEmail: created.contactEmail,
    quantity: created.quantity,
    askingPrice: created.askingPrice,
    artistSplitPercent: created.artistSplitPercent,
    artistPayout: roundMoney(created.askingPrice * created.quantity * (created.artistSplitPercent / 100)),
    status: 'out',
    placedAt: created.placedAt.toISOString(),
    returnDueAt: created.returnDueAt ? created.returnDueAt.toISOString() : null,
    closedAt: null,
    reminderSentAt: null,
    notes: created.notes,
  };
}

export async function updateConsignment(
  id: string,
  patch: {
    status?: ConsignmentStatus;
    venueName?: string;
    contactName?: string | null;
    contactEmail?: string | null;
    askingPrice?: number;
    artistSplitPercent?: number;
    returnDueAt?: string | null;
    notes?: string | null;
  },
  adminUserId?: string,
) {
  const existing = await db.consignmentPlacement.findUnique({ where: { id } });
  if (!existing) throw new Error('Consignment placement not found.');

  const prevStatus = normalizeConsignmentStatus(existing.status);
  const nextStatus = patch.status ? normalizeConsignmentStatus(patch.status) : prevStatus;
  const data: Record<string, unknown> = {};

  if (patch.venueName !== undefined && patch.venueName.trim()) {
    data.venueName = patch.venueName.trim().slice(0, 120);
  }
  if (patch.contactName !== undefined) {
    data.contactName = patch.contactName?.trim().slice(0, 100) || null;
  }
  if (patch.contactEmail !== undefined) {
    data.contactEmail = patch.contactEmail?.trim().slice(0, 160) || null;
  }
  if (patch.askingPrice !== undefined) {
    data.askingPrice = Math.max(0, roundMoney(patch.askingPrice));
  }
  if (patch.artistSplitPercent !== undefined) {
    data.artistSplitPercent = clampInt(patch.artistSplitPercent, 0, 100, existing.artistSplitPercent);
  }
  if (patch.returnDueAt !== undefined) {
    if (!patch.returnDueAt) {
      data.returnDueAt = null;
    } else {
      const parsed = new Date(patch.returnDueAt);
      if (!Number.isNaN(parsed.getTime())) data.returnDueAt = parsed;
    }
  }
  if (patch.notes !== undefined) {
    data.notes = patch.notes?.trim().slice(0, 1000) || null;
  }
  if (nextStatus !== prevStatus) {
    data.status = nextStatus;
    data.closedAt = nextStatus === 'out' ? null : new Date();
  }

  const updated = await db.consignmentPlacement.update({ where: { id }, data });

  // Sync stock movements & catalog availability cleanly on status transitions.
  if (prevStatus !== nextStatus) {
    const inventory = await InventoryService.getInventoryStatus(existing.productId);
    if (inventory) {
      if (prevStatus === 'out' && nextStatus === 'returned') {
        await InventoryService.recordStockMovement({
          productId: existing.productId,
          type: 'return',
          quantity: existing.quantity,
          userId: adminUserId,
          reason: `Returned from consignment at ${updated.venueName}`,
          notes: `Consignment placement ${id}`,
        }).catch(() => undefined);
        await db.product.updateMany({
          where: { id: existing.productId, availability: 'reserved' },
          data: { availability: 'available' },
        }).catch(() => undefined);
      } else if (prevStatus === 'returned' && nextStatus === 'out' && inventory.currentStock > 0) {
        const deduct = Math.min(inventory.currentStock, existing.quantity);
        await InventoryService.recordStockMovement({
          productId: existing.productId,
          type: 'transfer',
          quantity: -deduct,
          userId: adminUserId,
          reason: `Re-placed on consignment at ${updated.venueName}`,
          notes: `Consignment placement ${id}`,
        }).catch(() => undefined);
        if (inventory.availableStock - deduct <= 0) {
          await db.product.updateMany({
            where: { id: existing.productId, availability: { in: ['available', 'sold'] } },
            data: { availability: 'reserved' },
          }).catch(() => undefined);
        }
      } else if (nextStatus === 'sold') {
        await db.product.updateMany({
          where: { id: existing.productId, availability: 'reserved' },
          data: { availability: 'sold' },
        }).catch(() => undefined);
      }
    } else {
      const nextAvailability =
        nextStatus === 'returned' ? 'available' : nextStatus === 'sold' ? 'sold' : 'reserved';
      await db.product.update({
        where: { id: existing.productId },
        data: { availability: nextAvailability },
      }).catch(() => undefined);
    }
    try { revalidatePath('/shop'); } catch { /* ignore outside request */ }
  }

  return updated;
}

export async function deleteConsignment(id: string, adminUserId?: string): Promise<void> {
  const existing = await db.consignmentPlacement.findUnique({ where: { id } });
  if (!existing) return;

  await db.consignmentPlacement.delete({ where: { id } });

  // If deleting an active "out" placement, return stock so inventory stays accurate.
  if (existing.status === 'out') {
    const inventory = await InventoryService.getInventoryStatus(existing.productId);
    if (inventory) {
      await InventoryService.recordStockMovement({
        productId: existing.productId,
        type: 'return',
        quantity: existing.quantity,
        userId: adminUserId,
        reason: `Consignment removed (${existing.venueName})`,
        notes: `Deleted consignment placement ${id}`,
      }).catch(() => undefined);
    }
    await db.product.updateMany({
      where: { id: existing.productId, availability: 'reserved' },
      data: { availability: 'available' },
    }).catch(() => undefined);
    try { revalidatePath('/shop'); } catch { /* ignore outside request */ }
  }
}

/**
 * Scheduled automation hook: emails the artist once when an active consignment
 * placement is within 7 days of its return due date (or overdue).
 */
export async function processDueConsignmentReminders(now = new Date()): Promise<{
  attempted: number;
  sent: number;
  failed: number;
}> {
  const delivery = await getEmailDeliveryStatus();
  if (delivery.mode !== 'smtp') return { attempted: 0, sent: 0, failed: 0 };

  const recipient =
    (await getConfig('ARTIST_EMAIL')) ||
    (await getConfig('CONTACT_EMAIL')) ||
    (await getConfig('SUPPORT_EMAIL'));
  if (!recipient?.trim()) return { attempted: 0, sent: 0, failed: 0 };

  const reminderHorizon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const dueRows = await db.consignmentPlacement.findMany({
    where: {
      status: 'out',
      reminderSentAt: null,
      returnDueAt: { lte: reminderHorizon },
    },
    orderBy: { returnDueAt: 'asc' },
  });

  if (dueRows.length === 0) return { attempted: 0, sent: 0, failed: 0 };

  const productIds = Array.from(new Set(dueRows.map((r) => r.productId)));
  const [products, brand] = await Promise.all([
    db.product.findMany({ where: { id: { in: productIds } }, select: { id: true, title: true } }),
    getEmailBrand(),
  ]);
  const titleMap = new Map(products.map((p) => [p.id, p.title]));

  let sent = 0;
  let failed = 0;

  for (const row of dueRows) {
    const title = titleMap.get(row.productId) || row.productId;
    const dueLabel = row.returnDueAt ? row.returnDueAt.toLocaleDateString('en-US') : 'soon';
    const subject = `Consignment check-in: "${title}" at ${row.venueName}`;
    const html = brandedEmailHtml(brand, {
      title: 'Consignment Return Reminder',
      intro: `Your consigned work <strong>${escapeHtml(title)}</strong> at <strong>${escapeHtml(row.venueName)}</strong> has a return due date of <strong>${escapeHtml(dueLabel)}</strong>.`,
      sections: [
        {
          html: `<p style="margin:0;color:#374151;">Quantity: ${row.quantity} · Asking price: $${row.askingPrice.toFixed(2)} · Artist split: ${row.artistSplitPercent}%${row.contactName ? `<br>Venue contact: ${escapeHtml(row.contactName)}${row.contactEmail ? ` (${escapeHtml(row.contactEmail)})` : ''}` : ''}</p>`,
        },
      ],
      cta: {
        label: 'Manage Consignments',
        href: `${brand.siteUrl}/admin?tab=products&view=consignment`,
      },
      closing: 'Mark the piece as Returned to restore storefront stock, or Sold once settled.',
    });
    const text = `Consignment check-in: "${title}" at ${row.venueName} is due back ${dueLabel}. Manage at ${brand.siteUrl}/admin?tab=products&view=consignment`;

    const ok = await sendTemplateEmail(recipient.trim(), { subject, html, text }).catch(() => false);
    if (ok) {
      sent += 1;
      await db.consignmentPlacement.update({
        where: { id: row.id },
        data: { reminderSentAt: now },
      });
    } else {
      failed += 1;
    }
  }

  return { attempted: dueRows.length, sent, failed };
}
