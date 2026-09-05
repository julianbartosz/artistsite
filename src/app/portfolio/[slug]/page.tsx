import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { getArtworkBySlug, getArtworkSlugs } from '@/lib/portfolio';
import { MDXContent } from '@/components/MDXContent';
import { generatePortfolioMetadata } from '@/lib/seo';
import { StructuredData, generateVisualArtworkSchema, generateBreadcrumbSchema } from '@/components/StructuredData';

interface ArtworkDetailProps {
  params: Promise<{ slug: string }>;
}

export const dynamic = 'force-dynamic';

export default async function ArtworkDetail({ params }: ArtworkDetailProps) {
  const { slug } = await params;
  const artwork = await getArtworkBySlug(slug);

  if (!artwork) {
    notFound();
  }

  const artworkSchema = generateVisualArtworkSchema({
    title: artwork.title,
    description: artwork.description,
    creator: 'Artist',
    dateCreated: artwork.year,
    medium: artwork.medium,
    dimensions: artwork.dimensions,
    image: artwork.images.main,
    url: `/portfolio/${slug}`,
  });

  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Home', url: '/' },
    { name: 'Portfolio', url: '/portfolio' },
    { name: artwork.title, url: `/portfolio/${slug}` },
  ]);

  return (
    <>
      <StructuredData data={artworkSchema} />
      <StructuredData data={breadcrumbSchema} />

      <div className="min-h-screen bg-gray-50">
        <section className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-6xl mx-auto px-6 py-6 md:py-8">
            <nav className="mb-6" aria-label="Breadcrumb">
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

        <div className="max-w-6xl mx-auto px-6 py-10 md:py-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-12">
            <div className="space-y-4">
              {artwork.images.main && (
                <div className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 shadow-sm">
                  <Image
                    src={artwork.images.main}
                    alt={artwork.title}
                    fill
                    className="object-cover"
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    priority
                  />
                </div>
              )}

              {artwork.images.gallery && artwork.images.gallery.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {artwork.images.gallery.slice(0, 3).map((image, index) => (
                    <div key={index} className="relative aspect-square rounded overflow-hidden bg-gray-100">
                      <Image
                        src={image}
                        alt={`${artwork.title} - View ${index + 1}`}
                        fill
                        className="object-cover"
                        sizes="(max-width: 1024px) 33vw, 16vw"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-6">
              <header>
                <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                  {artwork.title}
                </h1>

                {artwork.description && (
                  <p className="text-lg text-gray-600 leading-relaxed mb-6">{artwork.description}</p>
                )}

                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  {artwork.medium && (
                    <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
                      <dt className="text-gray-500 mb-1">Medium</dt>
                      <dd className="font-medium text-gray-900">{artwork.medium}</dd>
                    </div>
                  )}
                  {artwork.dimensions && (
                    <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
                      <dt className="text-gray-500 mb-1">Dimensions</dt>
                      <dd className="font-medium text-gray-900">{artwork.dimensions}</dd>
                    </div>
                  )}
                  {artwork.year && (
                    <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
                      <dt className="text-gray-500 mb-1">Year</dt>
                      <dd className="font-medium text-gray-900">{artwork.year}</dd>
                    </div>
                  )}
                  {artwork.price && (
                    <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
                      <dt className="text-gray-500 mb-1">Price</dt>
                      <dd className="font-medium text-gray-900">{artwork.price}</dd>
                    </div>
                  )}
                </dl>

                <div className="mt-4">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                    artwork.available ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {artwork.available ? 'Available' : 'Sold'}
                  </span>
                </div>
              </header>

              {artwork.category && artwork.category.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {artwork.category.map((category: string) => (
                    <span
                      key={category}
                      className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full capitalize"
                    >
                      {category.replace('-', ' ')}
                    </span>
                  ))}
                </div>
              )}

              <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                <MDXContent code={artwork.code} />
              </div>

              {artwork.available && (
                <Link
                  href="/contact"
                  className="inline-flex w-full sm:w-auto justify-center bg-gray-900 text-white px-6 py-3 rounded-lg hover:bg-gray-800 transition-colors font-medium"
                >
                  Inquire About This Work
                </Link>
              )}
            </div>
          </div>

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
  const artwork = await getArtworkBySlug(slug);

  if (!artwork) {
    return {
      title: 'Artwork Not Found',
    };
  }

  return generatePortfolioMetadata({
    title: artwork.title,
    description: artwork.description,
    images: artwork.images,
    medium: artwork.medium,
    year: parseInt(artwork.year) || undefined,
    slug,
  });
}
