import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { getArtworkBySlug, getArtworkSlugs } from '@/lib/portfolio';
import { MDXContent } from '@/components/MDXContent';

interface ArtworkDetailProps {
  params: {
    slug: string;
  };
}

export default async function ArtworkDetail({ params }: ArtworkDetailProps) {
  const { slug } = params;
  const artwork = await getArtworkBySlug(slug);
  
  if (!artwork) {
    notFound();
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      {/* Breadcrumb */}
      <nav className="mb-8">
        <Link href="/portfolio" className="text-blue-600 hover:text-blue-700">
          ← Back to Portfolio
        </Link>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Image Gallery */}
        <div className="space-y-4">
          {/* Main Image */}
          <div className="relative aspect-square overflow-hidden rounded-lg bg-gray-100">
            <Image
              src={artwork.images.main}
              alt={artwork.title}
              fill
              className="object-cover"
              priority
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
          </div>

          {/* Gallery Images */}
          {artwork.images.gallery && artwork.images.gallery.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {artwork.images.gallery.map((image, index) => (
                <div key={index} className="relative aspect-square overflow-hidden rounded bg-gray-100">
                  <Image
                    src={image}
                    alt={`${artwork.title} detail ${index + 1}`}
                    fill
                    className="object-cover hover:scale-105 transition-transform cursor-pointer"
                    sizes="(max-width: 1024px) 33vw, 16vw"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Artwork Details */}
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">{artwork.title}</h1>
            <p className="text-lg text-gray-600">{artwork.description}</p>
          </div>

          {/* Artwork Specifications */}
          <div className="space-y-3 py-6 border-t border-b border-gray-200">
            <div className="flex justify-between">
              <span className="font-medium text-gray-900">Medium:</span>
              <span className="text-gray-700">{artwork.medium}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium text-gray-900">Dimensions:</span>
              <span className="text-gray-700">{artwork.dimensions}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium text-gray-900">Year:</span>
              <span className="text-gray-700">{artwork.year}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium text-gray-900">Status:</span>
              <span className={`font-medium ${
                artwork.available ? 'text-green-600' : 'text-red-600'
              }`}>
                {artwork.available ? 'Available' : 'Sold'}
              </span>
            </div>
            {artwork.price && artwork.available && (
              <div className="flex justify-between">
                <span className="font-medium text-gray-900">Price:</span>
                <span className="text-xl font-bold text-gray-900">{artwork.price}</span>
              </div>
            )}
          </div>

          {/* Categories */}
          <div>
            <h3 className="font-medium text-gray-900 mb-2">Categories</h3>
            <div className="flex flex-wrap gap-2">
              {artwork.category.map((cat) => (
                <span 
                  key={cat}
                  className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded"
                >
                  {cat}
                </span>
              ))}
            </div>
          </div>

          {/* Call to Action */}
          {artwork.available && (
            <div className="space-y-3">
              <button className="w-full bg-gray-900 text-white py-3 px-6 rounded hover:bg-gray-800 transition-colors font-medium">
                Inquire About This Piece
              </button>
              <p className="text-sm text-gray-500 text-center">
                Contact me for more details or to arrange a viewing
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Artist Statement / Extended Description */}
      {artwork.content && (
        <div className="mt-16 max-w-4xl">
          <div className="prose prose-lg max-w-none">
            <MDXContent code={artwork.code} />
          </div>
        </div>
      )}
    </div>
  );
}

// Generate static paths for all artworks
export async function generateStaticParams() {
  const slugs = await getArtworkSlugs();
  return slugs.map((slug) => ({
    slug,
  }));
}

// Generate metadata for SEO
export async function generateMetadata({ params }: ArtworkDetailProps) {
  const { slug } = params;
  const artwork = await getArtworkBySlug(slug);
  
  if (!artwork) {
    return {
      title: 'Artwork Not Found',
    };
  }
  
  return {
    title: `${artwork.title} | Portfolio`,
    description: artwork.description,
    openGraph: {
      title: artwork.title,
      description: artwork.description,
      type: 'article',
      images: artwork.images.main ? [artwork.images.main] : undefined,
    },
  };
}