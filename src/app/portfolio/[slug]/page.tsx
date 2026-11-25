import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getArtworkBySlug } from '@/lib/portfolio';
import { getSiteContent } from '@/lib/site-content';
import { displayFilterLabel } from '@/lib/search-params';
import ArtworkGallery from '@/components/ArtworkGallery';
import { MDXContent } from '@/components/MDXContent';
import { htmlHasVisibleText } from '@/lib/content-sanitize';
import { splitPlainParagraphs } from '@/lib/site-content-shared';
import { generatePortfolioMetadata, getSeoBrand } from '@/lib/seo';
import { getSiteUrl } from '@/lib/config';
import { StructuredData, generateVisualArtworkSchema, generateBreadcrumbSchema } from '@/components/StructuredData';
import { findShopProductForArtwork } from '@/lib/commerce-server';
import { artworkGalleryImages } from '@/lib/commerce';
import { isVideoUrl } from '@/lib/image-variant-url';

interface ArtworkDetailProps {
  params: Promise<{ slug: string }>;
}

export const dynamic = 'force-dynamic';

export default async function ArtworkDetail({ params }: ArtworkDetailProps) {
  const { slug } = await params;
  const [artwork, portfolioContent, identity, siteUrl] = await Promise.all([
    getArtworkBySlug(slug),
    getSiteContent('portfolio'),
    getSiteContent('identity'),
    getSiteUrl(),
  ]);

  if (!artwork) {
    notFound();
  }

  const shopProduct = await findShopProductForArtwork(artwork);
  const galleryFocus = portfolioContent.artworkDetailLayout === 'gallery-focus';
  const galleryMedia = artworkGalleryImages(artwork.images);
  const stillImage =
    [artwork.images.main, artwork.images.thumbnail, ...galleryMedia].find(
      (entry) => Boolean(entry && !isVideoUrl(entry)),
    ) || '';

  const artworkSchema = generateVisualArtworkSchema({
    title: artwork.title,
    description: artwork.description,
    creator: identity.siteName,
    dateCreated: artwork.year,
    medium: artwork.medium,
    dimensions: artwork.dimensions,
    image: stillImage,
    url: `/portfolio/${slug}`,
    siteUrl,
  });

  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Home', url: '/' },
    { name: portfolioContent.title, url: '/portfolio' },
    { name: artwork.title, url: `/portfolio/${slug}` },
  ], siteUrl);

  const inquiryHref = `/contact?${new URLSearchParams({
    inquiryType: 'purchase',
    subject: `Inquiry about ${artwork.title}`,
  }).toString()}`;

  const gallery = (
    <ArtworkGallery
      title={artwork.title}
      mainImage={galleryMedia[0] ?? artwork.images.main}
      galleryImages={galleryMedia}
      galleryFocus={galleryFocus}
    />
  );

  const hasDetailSpecs = Boolean(artwork.medium || artwork.dimensions || artwork.year || artwork.price);

  const details = (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
          {artwork.title}
        </h1>

        {artwork.description && (
          <div className="space-y-3 text-base text-gray-600 leading-relaxed mb-6">
            {splitPlainParagraphs(artwork.description).map((paragraph, index) => (
              <p key={index} className="whitespace-pre-line">{paragraph}</p>
            ))}
          </div>
        )}

        {hasDetailSpecs && (
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            {artwork.medium && (
              <div className="bg-surface border border-gray-200 rounded-lg px-4 py-3">
                <dt className="text-gray-500 mb-1">Medium</dt>
                <dd className="font-medium text-gray-900">{artwork.medium}</dd>
              </div>
            )}
            {artwork.dimensions && (
              <div className="bg-surface border border-gray-200 rounded-lg px-4 py-3">
                <dt className="text-gray-500 mb-1">Dimensions</dt>
                <dd className="font-medium text-gray-900">{artwork.dimensions}</dd>
              </div>
            )}
            {artwork.year && (
              <div className="bg-surface border border-gray-200 rounded-lg px-4 py-3">
                <dt className="text-gray-500 mb-1">Year</dt>
                <dd className="font-medium text-gray-900">{artwork.year}</dd>
              </div>
            )}
            {artwork.price && (
              <div className="bg-surface border border-gray-200 rounded-lg px-4 py-3">
                <dt className="text-gray-500 mb-1">Price</dt>
                <dd className="font-medium text-gray-900">{artwork.price}</dd>
              </div>
            )}
          </dl>
        )}

        {(artwork.available || portfolioContent.layout.showSoldBadge) && (
          <div className="mt-4">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
              artwork.available ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'
            }`}>
              {artwork.available ? 'Available' : 'Not available'}
            </span>
          </div>
        )}
      </header>

      {artwork.category && artwork.category.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-2" aria-label="Categories">
          {artwork.category.map((category: string) => (
            <Link
              key={category}
              href={`/portfolio?category=${encodeURIComponent(category)}`}
              className="text-sm text-gray-600 underline-offset-4 transition-colors hover:text-gray-900 hover:underline"
            >
              {displayFilterLabel(category)}
            </Link>
          ))}
        </div>
      )}

      {htmlHasVisibleText(artwork.code) && (
        <section
          aria-label="About this work"
          className="border-t border-gray-200 pt-6"
        >
          <MDXContent
            code={artwork.code}
            className="prose prose-lg max-w-none text-gray-700 prose-headings:font-semibold prose-headings:text-gray-900 prose-headings:mt-8 prose-headings:mb-3 prose-p:leading-relaxed prose-li:leading-relaxed first:prose-headings:mt-0"
          />
        </section>
      )}

      {shopProduct ? (
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href={`/shop/${shopProduct.slug || shopProduct.id}`}
            className="btn-primary inline-flex w-full sm:w-auto justify-center px-6 py-3 font-medium transition-colors"
          >
            {shopProduct.availability === 'available' ? 'Buy in shop' : 'View in shop'}
          </Link>
          {artwork.available && (
            <Link
              href={inquiryHref}
              className="btn-primary-outline inline-flex w-full sm:w-auto justify-center px-6 py-3 font-medium transition-colors"
            >
              Inquire about this work
            </Link>
          )}
        </div>
      ) : artwork.available ? (
        <Link
          href={inquiryHref}
          className="btn-primary inline-flex w-full sm:w-auto justify-center px-6 py-3 font-medium transition-colors"
        >
          Inquire about this work
        </Link>
      ) : null}
    </div>
  );

  return (
    <>
      <StructuredData data={artworkSchema} />
      <StructuredData data={breadcrumbSchema} />

      <div className="min-h-screen bg-surface-muted">
        <section className="bg-surface shadow-sm border-b border-gray-200">
          <div className="max-w-6xl mx-auto page-x py-4">
            <nav aria-label="Breadcrumb">
              <ol className="flex flex-wrap items-center gap-2 text-sm text-gray-500">
                <li><Link href="/" className="hover:text-gray-700">Home</Link></li>
                <li aria-hidden="true">/</li>
                <li><Link href="/portfolio" className="hover:text-gray-700">Portfolio</Link></li>
                <li aria-hidden="true">/</li>
                <li className="text-gray-900 truncate">{artwork.title}</li>
              </ol>
            </nav>
          </div>
        </section>

        <div className="max-w-6xl mx-auto page-x py-8 md:py-12">
          {galleryFocus ? (
            <div className="space-y-8">
              {gallery}
              <div className="max-w-3xl">{details}</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-12">
              {gallery}
              {details}
            </div>
          )}

          <footer className="mt-12 pt-8 border-t border-gray-200">
            <Link
              href="/portfolio"
              className="inline-flex items-center text-gray-600 hover:text-gray-900 transition-colors font-medium"
            >
              ← Back to Portfolio
            </Link>
          </footer>
        </div>
      </div>
    </>
  );
}

export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: ArtworkDetailProps) {
  const { slug } = await params;
  const [artwork, brand] = await Promise.all([getArtworkBySlug(slug), getSeoBrand()]);

  if (!artwork) {
    return {
      title: 'Artwork Not Found',
    };
  }

  return generatePortfolioMetadata({
    brand,
    title: artwork.title,
    description: artwork.description,
    images: artwork.images,
    medium: artwork.medium,
    year: parseInt(artwork.year) || undefined,
    slug,
  });
}
