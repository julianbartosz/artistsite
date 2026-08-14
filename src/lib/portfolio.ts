import 'server-only';
import { unstable_cache } from 'next/cache';
import { db } from '@/lib/db';
import { sanitizeRichHtml } from '@/lib/content-sanitize';

const ARTWORK_IMAGE_FALLBACK = '/images/shop/placeholder-1.jpg';

export interface ArtworkPiece {
  slug: string;
  title: string;
  description: string;
  medium: string;
  dimensions: string;
  year: string;
  category: string[];
  featured: boolean;
  available: boolean;
  price?: string;
  images: {
    main: string;
    gallery?: string[];
    thumbnail: string;
  };
  createdAt: string;
}

export interface ArtworkPieceWithContent extends ArtworkPiece {
  content: string;
  code: string;
}

type ArtworkRecord = {
  slug: string;
  title: string;
  description: string;
  medium: string;
  dimensions: string;
  year: string;
  category: unknown;
  featured: boolean;
  available: boolean;
  price?: string | null;
  images: unknown;
  content?: string;
  createdAt: Date;
};

function categoryFromJson(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((category): category is string => typeof category === 'string') : ['uncategorized'];
}

function imagesFromJson(value: unknown): ArtworkPiece['images'] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {
      main: ARTWORK_IMAGE_FALLBACK,
      gallery: [],
      thumbnail: ARTWORK_IMAGE_FALLBACK,
    };
  }

  const images = value as Partial<ArtworkPiece['images']>;
  return {
    main: images.main || ARTWORK_IMAGE_FALLBACK,
    gallery: Array.isArray(images.gallery) ? images.gallery : [],
    thumbnail: images.thumbnail || images.main || ARTWORK_IMAGE_FALLBACK,
  };
}

function toArtwork(record: ArtworkRecord): ArtworkPiece {
  return {
    slug: record.slug,
    title: record.title,
    description: record.description,
    medium: record.medium,
    dimensions: record.dimensions,
    year: record.year,
    category: categoryFromJson(record.category),
    featured: record.featured,
    available: record.available,
    price: record.price || undefined,
    images: imagesFromJson(record.images),
    createdAt: record.createdAt.toISOString(),
  };
}

const getCachedArtworks = unstable_cache(
  async () => {
    const artworks = await db.artwork.findMany({
      orderBy: [{ featured: 'desc' }, { createdAt: 'desc' }],
    });
    return artworks.map((artwork) => toArtwork(artwork as ArtworkRecord));
  },
  ['artworks'],
  { tags: ['artworks'], revalidate: 300 }
);

export async function getAllArtworks(): Promise<ArtworkPiece[]> {
  return getCachedArtworks();
}

export async function getArtworkBySlug(slug: string): Promise<ArtworkPieceWithContent | null> {
  const artwork = await db.artwork.findUnique({
    where: { slug },
  });

  if (!artwork) {
    return null;
  }

  const content = sanitizeRichHtml(artwork.content);
  return {
    ...toArtwork(artwork as ArtworkRecord),
    content,
    code: content,
  };
}

export async function getArtworkSlugs(): Promise<string[]> {
  const artworks = await db.artwork.findMany({
    select: { slug: true },
  });
  return artworks.map((artwork) => artwork.slug);
}

export async function getFeaturedArtworks(limit = 3): Promise<ArtworkPiece[]> {
  const allArtworks = await getAllArtworks();
  return allArtworks.filter(artwork => artwork.featured).slice(0, limit);
}

export async function getArtworksByCategory(category: string): Promise<ArtworkPiece[]> {
  const allArtworks = await getAllArtworks();
  return allArtworks.filter(artwork =>
    artwork.category.some(cat => cat.toLowerCase() === category.toLowerCase())
  );
}

export function getUniqueCategories(artworks: ArtworkPiece[]): string[] {
  const categories = new Set<string>();
  artworks.forEach(artwork => {
    artwork.category.forEach(cat => categories.add(cat));
  });
  return Array.from(categories).sort();
}