import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { bundleMDX } from 'mdx-bundler';

const portfolioDir = path.join(process.cwd(), 'src', 'content', 'portfolio');

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

export async function getAllArtworks(): Promise<ArtworkPiece[]> {
  if (!fs.existsSync(portfolioDir)) {
    return [];
  }

  const files = fs.readdirSync(portfolioDir);
  const artworks = await Promise.all(
    files
      .filter(file => file.endsWith('.mdx'))
      .map(async file => {
        const slug = file.replace(/\.mdx$/, '');
        const filePath = path.join(portfolioDir, file);
        const source = fs.readFileSync(filePath, 'utf8');
        const { data } = matter(source);

        return {
          slug,
          title: data.title || 'Untitled',
          description: data.description || '',
          medium: data.medium || 'Mixed Media',
          dimensions: data.dimensions || '',
          year: data.year || new Date().getFullYear().toString(),
          category: data.category || ['uncategorized'],
          featured: data.featured || false,
          available: data.available || false,
          price: data.price,
          images: {
            main: data.images?.main || '/images/portfolio/placeholder.jpg',
            gallery: data.images?.gallery || [],
            thumbnail: data.images?.thumbnail || data.images?.main || '/images/portfolio/placeholder.jpg'
          },
          createdAt: data.createdAt || new Date().toISOString()
        } as ArtworkPiece;
      })
  );

  // Sort by featured first, then by creation date (newest first)
  return artworks.sort((a, b) => {
    if (a.featured && !b.featured) return -1;
    if (!a.featured && b.featured) return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

export async function getArtworkBySlug(slug: string): Promise<ArtworkPieceWithContent | null> {
  const filePath = path.join(portfolioDir, `${slug}.mdx`);
  
  if (!fs.existsSync(filePath)) {
    return null;
  }

  const source = fs.readFileSync(filePath, 'utf8');
  const { data, content } = matter(source);

  try {
    const { code } = await bundleMDX({
      source,
      mdxOptions(options) {
        options.remarkPlugins = [...(options.remarkPlugins ?? [])];
        options.rehypePlugins = [...(options.rehypePlugins ?? [])];
        return options;
      },
    });

    return {
      slug,
      title: data.title || 'Untitled',
      description: data.description || '',
      medium: data.medium || 'Mixed Media',
      dimensions: data.dimensions || '',
      year: data.year || new Date().getFullYear().toString(),
      category: data.category || ['uncategorized'],
      featured: data.featured || false,
      available: data.available || false,
      price: data.price,
      images: {
        main: data.images?.main || '/images/portfolio/placeholder.jpg',
        gallery: data.images?.gallery || [],
        thumbnail: data.images?.thumbnail || data.images?.main || '/images/portfolio/placeholder.jpg'
      },
      createdAt: data.createdAt || new Date().toISOString(),
      content,
      code
    };
  } catch (error) {
    console.error(`Error bundling MDX for artwork ${slug}:`, error);
    return null;
  }
}

export async function getArtworkSlugs(): Promise<string[]> {
  if (!fs.existsSync(portfolioDir)) {
    return [];
  }

  const files = fs.readdirSync(portfolioDir);
  return files
    .filter(file => file.endsWith('.mdx'))
    .map(file => file.replace(/\.mdx$/, ''));
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