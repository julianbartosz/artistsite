'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import QRCode from 'qrcode';
import { Check, Copy, Download, ExternalLink, Printer, QrCode } from 'lucide-react';
import {
  buildMarketQrFilename,
  buildMarketQrUrl,
  buildPrintableQrSignHtml,
  formatMarketQrDisplayUrl,
  getMarketQrPrompt,
  isLocalOrigin,
  MARKET_QR_DESTINATIONS,
  type MarketQrDestination,
} from '@/lib/market-qr';

interface PublicConfigResponse {
  NEXT_PUBLIC_SITE_URL?: string;
  NEXT_PUBLIC_BASE_URL?: string;
}

export function MarketQrCard({ onSelectTab }: { onSelectTab?: (tab: string) => void }) {
  const [siteOrigin, setSiteOrigin] = useState<string>('');
  const [originSource, setOriginSource] = useState<'configured' | 'fallback' | 'loading'>('loading');
  const [destination, setDestination] = useState<MarketQrDestination>('home');
  const [customPath, setCustomPath] = useState<string>('');
  const [label, setLabel] = useState<string>('');
  const [qrPngDataUrl, setQrPngDataUrl] = useState<string>('');
  const [qrSvgMarkup, setQrSvgMarkup] = useState<string>('');
  const [qrError, setQrError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadSiteOrigin() {
      try {
        const response = await fetch('/api/config/public');
        const data: PublicConfigResponse | null = response.ok ? await response.json() : null;
        const configured = (data?.NEXT_PUBLIC_SITE_URL || data?.NEXT_PUBLIC_BASE_URL || '').trim();
        if (!cancelled && configured) {
          setSiteOrigin(new URL(configured).origin);
          setOriginSource('configured');
          return;
        }
      } catch {
        // Fall through to current browser origin.
      }
      if (!cancelled && typeof window !== 'undefined') {
        setSiteOrigin(window.location.origin);
        setOriginSource('fallback');
      }
    }
    void loadSiteOrigin();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current !== null) {
        window.clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  const { targetUrl, pathError } = useMemo(() => {
    if (!siteOrigin) return { targetUrl: '', pathError: null as string | null };
    try {
      return {
        targetUrl: buildMarketQrUrl(siteOrigin, destination, label, customPath),
        pathError: null as string | null,
      };
    } catch (error) {
      return {
        targetUrl: '',
        pathError: error instanceof Error ? error.message : 'Enter a valid page path on your site.',
      };
    }
  }, [siteOrigin, destination, label, customPath]);

  useEffect(() => {
    if (!targetUrl) {
      setQrPngDataUrl('');
      setQrSvgMarkup('');
      return;
    }

    let cancelled = false;
    setQrError(null);

    Promise.all([
      QRCode.toDataURL(targetUrl, {
        errorCorrectionLevel: 'H',
        margin: 4,
        width: 1024,
        color: { dark: '#000000', light: '#ffffff' },
      }),
      QRCode.toString(targetUrl, {
        type: 'svg',
        errorCorrectionLevel: 'H',
        margin: 4,
        color: { dark: '#000000', light: '#ffffff' },
      }),
    ])
      .then(([pngUrl, svgMarkup]) => {
        if (!cancelled) {
          setQrPngDataUrl(pngUrl);
          setQrSvgMarkup(svgMarkup);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setQrPngDataUrl('');
          setQrSvgMarkup('');
          setQrError('Could not render QR code. Check your public site URL in Settings.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [targetUrl]);

  const qrReady = Boolean(qrPngDataUrl && qrSvgMarkup && !qrError && !pathError);
  const displayUrl = targetUrl ? formatMarketQrDisplayUrl(targetUrl) : '';

  const triggerDownload = (href: string, filename: string, revokeAfter?: boolean) => {
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    if (revokeAfter) {
      window.setTimeout(() => URL.revokeObjectURL(href), 1000);
    }
  };

  const handleDownloadPng = () => {
    if (!qrPngDataUrl || !qrReady) return;
    setNotice(null);
    triggerDownload(qrPngDataUrl, buildMarketQrFilename(destination, label, 'png', customPath));
  };

  const handleDownloadSvg = () => {
    if (!qrSvgMarkup || !qrReady) return;
    setNotice(null);
    const blob = new Blob([qrSvgMarkup], { type: 'image/svg+xml;charset=utf-8' });
    const objectUrl = URL.createObjectURL(blob);
    triggerDownload(objectUrl, buildMarketQrFilename(destination, label, 'svg', customPath), true);
  };

  const handlePrintSign = () => {
    if (!qrSvgMarkup || !qrReady || !displayUrl) return;
    setNotice(null);
    const printWindow = window.open('', '_blank', 'width=720,height=860');
    if (!printWindow) {
      setNotice('Allow pop-ups in your browser to open the printable sign.');
      return;
    }
    printWindow.opener = null;
    const html = buildPrintableQrSignHtml({
      svgMarkup: qrSvgMarkup,
      headline: getMarketQrPrompt(destination),
      displayUrl,
      eventLabel: label,
    });
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
  };

  const handleCopyLink = async () => {
    if (!targetUrl) return;
    setNotice(null);
    let didCopy = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(targetUrl);
        didCopy = true;
      }
    } catch {
      // Fall back to execCommand below for non-HTTPS / restricted contexts.
    }
    if (!didCopy) {
      try {
        const helper = document.createElement('textarea');
        helper.value = targetUrl;
        helper.setAttribute('readonly', '');
        helper.style.position = 'fixed';
        helper.style.opacity = '0';
        document.body.appendChild(helper);
        helper.select();
        didCopy = document.execCommand('copy');
        helper.remove();
      } catch {
        didCopy = false;
      }
    }
    if (didCopy) {
      setCopied(true);
      if (copyTimeoutRef.current !== null) {
        window.clearTimeout(copyTimeoutRef.current);
      }
      copyTimeoutRef.current = window.setTimeout(() => {
        setCopied(false);
        copyTimeoutRef.current = null;
      }, 2000);
    } else {
      setNotice('Could not copy automatically — select and copy the link directly.');
    }
  };

  const showLocalWarning = Boolean(siteOrigin && isLocalOrigin(siteOrigin));

  return (
    <section
      data-testid="market-qr-card"
      className="rounded-lg border bg-white p-6 space-y-4"
    >
      <div>
        <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
          <QrCode className="h-5 w-5 text-gray-700" aria-hidden="true" />
          Market QR code
        </h3>
        <p className="mt-0.5 text-sm text-gray-600">
          Download or print a high-contrast QR code for art fairs, booths, or studio signage. Scans include UTM tags for Analytics.
        </p>
      </div>

      {showLocalWarning && (
        <div
          role="status"
          className="rounded-md border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900"
        >
          {originSource === 'configured' ? (
            <>
              Public site URL is currently set to <span className="font-mono">{siteOrigin}</span>, which phones at an event cannot open.{' '}
            </>
          ) : (
            <>
              Using <span className="font-mono">{siteOrigin}</span> because your Public site URL is not configured yet.{' '}
            </>
          )}
          {onSelectTab ? (
            <button
              type="button"
              onClick={() => onSelectTab('settings')}
              className="font-medium underline hover:text-amber-950"
            >
              Update Public site URL in Settings
            </button>
          ) : (
            <Link href="/admin?tab=settings#settings-group-site-identity" className="font-medium underline hover:text-amber-950">
              Update Public site URL in Settings
            </Link>
          )}{' '}
          before printing.
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1fr)_224px] md:items-start">
        <div className="min-w-0 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium text-gray-700">
              Destination
              <select
                value={destination}
                onChange={(event) => setDestination(event.target.value as MarketQrDestination)}
                className="mt-1 block h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-normal text-gray-900"
              >
                {MARKET_QR_DESTINATIONS.map((preset) => (
                  <option key={preset.key} value={preset.key}>
                    {preset.key === 'custom' ? preset.label : `${preset.label} (${preset.path})`}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-medium text-gray-700">
              Event label <span className="font-normal text-gray-400">(optional)</span>
              <input
                type="text"
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder="e.g. Spring Fair"
                maxLength={60}
                className="mt-1 block h-10 w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-normal text-gray-900 placeholder:text-gray-400"
              />
            </label>
          </div>

          {destination === 'custom' && (
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Page path
                <input
                  type="text"
                  value={customPath}
                  onChange={(event) => setCustomPath(event.target.value)}
                  placeholder="/shop/mushroom-postcard"
                  className={`mt-1 block h-10 w-full rounded-md border px-3 py-2 font-mono text-sm font-normal text-gray-900 placeholder:text-gray-400 ${
                    pathError ? 'border-red-300 bg-red-50/40' : 'border-gray-300'
                  }`}
                />
              </label>
              {pathError ? (
                <p className="mt-1 text-xs text-red-600">{pathError}</p>
              ) : (
                <p className="mt-1 text-xs text-gray-500">
                  Enter any path on your site (like <span className="font-mono">/shop/piece-slug</span> or <span className="font-mono">/blog</span>), or paste a full link from your site.
                </p>
              )}
            </div>
          )}

          <div className="rounded-md border border-gray-200 bg-gray-50 px-3.5 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-gray-500">Encoded link</span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => void handleCopyLink()}
                  disabled={!targetUrl}
                  className="inline-flex items-center gap-1 text-xs font-medium text-gray-700 hover:text-gray-950 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                      Copy link
                    </>
                  )}
                </button>
                {targetUrl && (
                  <a
                    href={targetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-gray-700 hover:text-gray-950"
                  >
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    Test link
                  </a>
                )}
              </div>
            </div>
            <p className="mt-1 break-all font-mono text-xs text-gray-800">
              {targetUrl || (pathError ? 'Fix the page path above to generate a link.' : 'Loading site URL…')}
            </p>
          </div>

          {notice && (
            <p role="status" className="text-xs text-amber-800">
              {notice}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleDownloadPng}
              disabled={!qrReady}
              className="inline-flex items-center gap-2 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Download PNG
            </button>
            <button
              type="button"
              onClick={handleDownloadSvg}
              disabled={!qrReady}
              className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Download SVG
            </button>
            <button
              type="button"
              onClick={handlePrintSign}
              disabled={!qrReady}
              className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Printer className="h-4 w-4" aria-hidden="true" />
              Print sign
            </button>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center rounded-lg border border-gray-200 bg-white p-3.5">
          {qrError || pathError ? (
            <div className="flex h-44 w-44 items-center justify-center text-center text-xs text-red-600 sm:h-48 sm:w-48">
              {qrError || pathError}
            </div>
          ) : qrPngDataUrl ? (
            <Image
              src={qrPngDataUrl}
              alt={targetUrl ? `QR code for ${targetUrl}` : 'Market QR code preview'}
              width={192}
              height={192}
              unoptimized
              className="block h-44 w-44 rounded select-none sm:h-48 sm:w-48"
            />
          ) : (
            <div className="h-44 w-44 animate-pulse rounded bg-gray-100 sm:h-48 sm:w-48" aria-hidden="true" />
          )}
          <span className="mt-2 max-w-[192px] truncate text-xs font-medium text-gray-700" title={displayUrl}>
            {displayUrl || 'Preparing preview…'}
          </span>
          <span className="mt-0.5 text-[11px] text-gray-500">1024 px PNG · Vector SVG · Level H</span>
        </div>
      </div>
    </section>
  );
}
