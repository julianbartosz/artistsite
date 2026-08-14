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

  // Generate structured data
  const artworkSchema = generateVisualArtworkSchema({
    title: artwork.title,
    description: artwork.description,
    creator: 'Artist', // You can make this dynamic based on your data
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
      
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Back to portfolio link */}
        <Link 
          href="/portfolio"
          className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-8 transition-colors"
        >
          ← Back to Portfolio
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Main image */}
          <div className="space-y-4">
            {artwork.images.main && (
              <div className="relative aspect-square">
                <Image
                  src={artwork.images.main}
                  alt={artwork.title}
                  fill
                  className="object-cover rounded-lg"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  priority
                />
              </div>
            )}

            {/* Gallery images */}
            {artwork.images.gallery && artwork.images.gallery.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {artwork.images.gallery.slice(0, 3).map((image, index) => (
                  <div key={index} className="relative aspect-square">
                    <Image
                      src={image}
                      alt={`${artwork.title} - View ${index + 1}`}
                      fill
                      className="object-cover rounded"
                      sizes="(max-width: 1024px) 33vw, 16vw"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Artwork details */}
          <div className="space-y-6">
            <header>
              <h1 className="text-4xl font-bold text-gray-900 mb-4">
                {artwork.title}
              </h1>
              
              <div className="space-y-2 text-gray-600">
                {artwork.medium && (
                  <p><span className="font-medium">Medium:</span> {artwork.medium}</p>
                )}
                {artwork.dimensions && (
                  <p><span className="font-medium">Dimensions:</span> {artwork.dimensions}</p>
                )}
                {artwork.year && (
                  <p><span className="font-medium">Year:</span> {artwork.year}</p>
                )}
                {artwork.price && (
                  <p><span className="font-medium">Price:</span> {artwork.price}</p>
                )}
              </div>
            </header>

            <div className="prose prose-lg">
              <MDXContent code={artwork.code} />
            </div>

            {/* Categories */}
            {artwork.category && artwork.category.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {artwork.category.map((category: string) => (
                  <span 
                    key={category}
                    className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full"
                  >
                    {category}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// Generate static paths for all artworks
export async function generateStaticParams() {
  return [];
}

// Generate metadata for SEO
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