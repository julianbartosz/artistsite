import 'server-only';
import { randomBytes } from 'crypto';
import { db } from '@/lib/db';
import { getConfig } from '@/lib/config';
import { getEmailBrand } from '@/lib/email';
import { formatEditionStatus, productImageSrc } from '@/lib/commerce';
import {
  normalizeLicenseType,
  type CertificateRecord,
  type LicenseType,
} from '@/lib/jobs-shared';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateCertificateCode(): string {
  const bytes = randomBytes(8);
  let chars = '';
  for (let i = 0; i < 8; i++) {
    chars += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return `COA-${chars.slice(0, 4)}-${chars.slice(4, 8)}`;
}

function toCertificateRecord(row: {
  id: string;
  code: string;
  orderId: string | null;
  jobId: string | null;
  productId: string | null;
  artworkTitle: string;
  artistName: string;
  medium: string | null;
  dimensions: string | null;
  year: number | null;
  editionInfo: string | null;
  licenseType: string;
  collectorName: string | null;
  artworkImage: string | null;
  issuedAt: Date;
  revokedAt: Date | null;
}): CertificateRecord {
  return {
    id: row.id,
    code: row.code,
    orderId: row.orderId,
    jobId: row.jobId,
    productId: row.productId,
    artworkTitle: row.artworkTitle,
    artistName: row.artistName,
    medium: row.medium,
    dimensions: row.dimensions,
    year: row.year,
    editionInfo: row.editionInfo,
    licenseType: normalizeLicenseType(row.licenseType),
    collectorName: row.collectorName,
    artworkImage: row.artworkImage,
    issuedAt: row.issuedAt.toISOString(),
    revokedAt: row.revokedAt ? row.revokedAt.toISOString() : null,
  };
}

/**
 * Idempotently issues Certificates of Authenticity for any paid order items
 * whose Product has `specifications.certificate === true`.
 */
export async function issueCertificatesForOrder(
  orderId: string,
  options?: { forceAllItems?: boolean },
): Promise<CertificateRecord[]> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: {
      items: true,
      shippingAddress: true,
    },
  });
  if (!order || order.paymentStatus !== 'paid' || order.items.length === 0) {
    return [];
  }

  const productIds = Array.from(new Set(order.items.map((item) => item.productId).filter(Boolean)));
  if (productIds.length === 0) return [];

  const [products, brand, defaultLicenseRaw] = await Promise.all([
    db.product.findMany({ where: { id: { in: productIds } } }),
    getEmailBrand(),
    getConfig('DEFAULT_LICENSE_TYPE'),
  ]);
  const defaultLicense = normalizeLicenseType(defaultLicenseRaw, 'personal');
  const productMap = new Map(products.map((p) => [p.id, p]));
  const collectorName = order.shippingAddress
    ? [order.shippingAddress.firstName, order.shippingAddress.lastName].filter(Boolean).join(' ').trim() || null
    : null;

  const issued: CertificateRecord[] = [];
  for (const item of order.items) {
    const product = productMap.get(item.productId);
    const specs = (product?.specifications && typeof product.specifications === 'object'
      ? product.specifications
      : {}) as { certificate?: boolean; licenseType?: LicenseType };
    if (!options?.forceAllItems && (!product || !specs.certificate)) continue;

    const lookupProductId = product?.id ?? item.productId;
    const existing = await db.certificateOfAuthenticity.findUnique({
      where: {
        orderId_productId: {
          orderId: order.id,
          productId: lookupProductId,
        },
      },
    });
    if (existing) {
      issued.push(toCertificateRecord(existing));
      continue;
    }

    const editionObj =
      product?.edition && typeof product.edition === 'object'
        ? (product.edition as { total?: number; remaining?: number })
        : null;
    const editionInfo = editionObj?.total
      ? formatEditionStatus({ total: editionObj.total, remaining: editionObj.remaining ?? 0 })
      : product?.category?.toLowerCase().includes('original')
        ? 'Original 1 of 1'
        : null;

    const rawImages =
      product?.images && typeof product.images === 'object'
        ? (product.images as { thumbnail?: string; gallery?: string[] })
        : null;
    const imageSrc = rawImages
      ? productImageSrc({
          images: {
            thumbnail: rawImages.thumbnail ?? '',
            gallery: Array.isArray(rawImages.gallery) ? rawImages.gallery : [],
          },
        })
      : '';

    const created = await db.certificateOfAuthenticity.create({
      data: {
        code: generateCertificateCode(),
        orderId: order.id,
        productId: lookupProductId,
        artworkTitle: product?.title || item.productTitle,
        artistName: brand.siteName,
        medium: product?.medium || null,
        dimensions: product?.dimensions || null,
        year: product?.year || new Date().getFullYear(),
        editionInfo,
        licenseType: normalizeLicenseType(specs.licenseType, defaultLicense),
        collectorName,
        collectorEmail: order.userEmail || null,
        artworkImage: imageSrc || item.productImage || null,
      },
    });
    issued.push(toCertificateRecord(created));
  }

  return issued;
}

/** Idempotently issues a Certificate of Authenticity for a StudioJob. */
export async function issueCertificateForJob(jobId: string): Promise<CertificateRecord> {
  const existing = await db.certificateOfAuthenticity.findFirst({
    where: { jobId },
    orderBy: { issuedAt: 'desc' },
  });
  if (existing) return toCertificateRecord(existing);

  const [job, brand] = await Promise.all([
    db.studioJob.findUnique({ where: { id: jobId } }),
    getEmailBrand(),
  ]);
  if (!job) throw new Error('Job not found');

  const created = await db.certificateOfAuthenticity.create({
    data: {
      code: generateCertificateCode(),
      jobId: job.id,
      orderId: job.balanceOrderId || job.depositOrderId || null,
      artworkTitle: job.title,
      artistName: brand.siteName,
      medium: job.medium || null,
      dimensions: job.dimensions || null,
      year: new Date().getFullYear(),
      editionInfo: 'Custom Commission (1 of 1)',
      licenseType: normalizeLicenseType(job.licenseType),
      collectorName: job.clientName || null,
      collectorEmail: job.clientEmail || null,
    },
  });

  return toCertificateRecord(created);
}

export async function getCertificateByCode(code: string): Promise<CertificateRecord | null> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return null;
  const row = await db.certificateOfAuthenticity.findUnique({
    where: { code: normalized },
  });
  return row ? toCertificateRecord(row) : null;
}

export async function listCertificatesByOrderIds(
  orderIds: string[],
): Promise<Record<string, CertificateRecord[]>> {
  if (orderIds.length === 0) return {};
  const rows = await db.certificateOfAuthenticity.findMany({
    where: { orderId: { in: orderIds }, revokedAt: null },
    orderBy: { issuedAt: 'asc' },
  });
  const map: Record<string, CertificateRecord[]> = {};
  for (const row of rows) {
    if (!row.orderId) continue;
    if (!map[row.orderId]) map[row.orderId] = [];
    map[row.orderId].push(toCertificateRecord(row));
  }
  return map;
}

export async function listCertificatesForCollector(email: string): Promise<CertificateRecord[]> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return [];
  const rows = await db.certificateOfAuthenticity.findMany({
    where: {
      collectorEmail: { equals: normalized, mode: 'insensitive' },
      revokedAt: null,
    },
    orderBy: { issuedAt: 'desc' },
  });
  return rows.map(toCertificateRecord);
}
