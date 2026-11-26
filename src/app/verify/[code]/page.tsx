import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import QRCode from 'qrcode';
import { Award, ShieldCheck } from 'lucide-react';
import { getCertificateByCode } from '@/lib/certificates';
import { getEmailBrand } from '@/lib/email';
import { LICENSE_DEFINITIONS } from '@/lib/jobs-shared';
import CertificatePrintButton from './CertificatePrintButton';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  const cert = await getCertificateByCode(code);
  if (!cert) return { title: 'Certificate Not Found' };
  return {
    title: `Certificate of Authenticity · ${cert.artworkTitle}`,
    description: `Verified authenticity record ${cert.code} issued by ${cert.artistName}.`,
  };
}

export default async function VerifyCertificatePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const [cert, brand] = await Promise.all([getCertificateByCode(code), getEmailBrand()]);
  if (!cert) notFound();

  const verifyUrl = `${brand.siteUrl}/verify/${encodeURIComponent(cert.code)}`;
  const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
    width: 180,
    margin: 1,
    color: { dark: '#111827', light: '#ffffff' },
  }).catch(() => '');

  const licenseDef = LICENSE_DEFINITIONS[cert.licenseType];
  const isRevoked = Boolean(cert.revokedAt);

  return (
    <div className="min-h-screen bg-stone-50 py-10 px-4 sm:px-6 lg:px-8 print:bg-white print:p-0">
      <div className="mx-auto max-w-2xl space-y-5">
        <div className="flex items-center justify-between gap-3 print:hidden">
          <Link href="/" className="text-sm font-medium text-gray-600 hover:text-gray-900">
            ← {brand.siteName}
          </Link>
          <CertificatePrintButton />
        </div>

        <article className="overflow-hidden rounded-2xl border-2 border-stone-300 bg-white p-8 sm:p-10 shadow-sm print:rounded-none print:border print:shadow-none">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-stone-200 pb-6">
            <div>
              <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
                <Award className="h-4 w-4 text-stone-700" aria-hidden="true" />
                Certificate of Authenticity
              </p>
              <h1 className="mt-2 font-serif text-3xl font-bold text-gray-900">
                {cert.artworkTitle}
              </h1>
              <p className="mt-1 text-base text-gray-700">by {cert.artistName}</p>
            </div>

            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${
                isRevoked
                  ? 'border-red-200 bg-red-50 text-red-800'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-800'
              }`}
            >
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              {isRevoked ? 'Revoked' : 'Verified Original Record'}
            </span>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-[1fr_140px]">
            <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
              {cert.medium && (
                <div>
                  <dt className="text-xs uppercase tracking-wider text-stone-500">Medium</dt>
                  <dd className="mt-0.5 font-medium text-gray-900">{cert.medium}</dd>
                </div>
              )}
              {cert.dimensions && (
                <div>
                  <dt className="text-xs uppercase tracking-wider text-stone-500">Dimensions</dt>
                  <dd className="mt-0.5 font-medium text-gray-900">{cert.dimensions}</dd>
                </div>
              )}
              {cert.year && (
                <div>
                  <dt className="text-xs uppercase tracking-wider text-stone-500">Year</dt>
                  <dd className="mt-0.5 font-medium text-gray-900">{cert.year}</dd>
                </div>
              )}
              {cert.editionInfo && (
                <div>
                  <dt className="text-xs uppercase tracking-wider text-stone-500">Edition</dt>
                  <dd className="mt-0.5 font-medium text-gray-900">{cert.editionInfo}</dd>
                </div>
              )}
              <div>
                <dt className="text-xs uppercase tracking-wider text-stone-500">License</dt>
                <dd className="mt-0.5 font-medium text-gray-900">{licenseDef.label}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-stone-500">Issued</dt>
                <dd className="mt-0.5 font-medium text-gray-900">
                  {new Date(cert.issuedAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </dd>
              </div>
              {cert.collectorName && (
                <div className="sm:col-span-2">
                  <dt className="text-xs uppercase tracking-wider text-stone-500">Registered Collector</dt>
                  <dd className="mt-0.5 font-medium text-gray-900">{cert.collectorName}</dd>
                </div>
              )}
            </dl>

            {cert.artworkImage && (
              <div className="flex justify-center sm:justify-end">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={cert.artworkImage}
                  alt={cert.artworkTitle}
                  className="h-36 w-36 rounded-lg border border-stone-200 object-cover"
                />
              </div>
            )}
          </div>

          <p className="mt-6 border-t border-stone-200 pt-5 text-xs leading-relaxed text-stone-600">
            This certificate confirms that the work described above is an authentic creation of {cert.artistName}.{' '}
            {licenseDef.termsClause}
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-stone-200 pt-6">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-stone-500">Verification Code</p>
              <p className="mt-0.5 font-mono text-base font-bold tracking-wider text-gray-900">
                {cert.code}
              </p>
              <p className="mt-0.5 text-[11px] text-stone-500 break-all">{verifyUrl}</p>
            </div>
            {qrDataUrl && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={qrDataUrl}
                alt={`QR code verifying ${cert.code}`}
                className="h-24 w-24 rounded border border-stone-200 p-1 bg-white"
              />
            )}
          </div>
        </article>
      </div>
    </div>
  );
}
