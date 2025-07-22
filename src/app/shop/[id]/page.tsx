import React from 'react';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { getProductById, getAllProducts } from '@/lib/commerce';
import ProductPageClient from './ProductPageClient';

interface ProductPageProps {
  params: Promise<{
    id: string;
  }>;
}

// Enable ISR with 1 hour revalidation
export const revalidate = 3600;

// Enable dynamic rendering for cart interactions
export const dynamic = 'force-dynamic';

export async function generateStaticParams() {
  const products = getAllProducts();
  
  // Only pre-render featured products to reduce build time
  const featuredProducts = products.filter(product => product.featured);
  
  return featuredProducts.map((product) => ({
    id: product.id,
  }));
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { id } = await params;
  const product = getProductById(id);
  
  if (!product) {
    return {
      title: 'Product Not Found',
      description: 'The requested product could not be found.',
    };
  }
  
  const mainImage = product.images.gallery[0] || product.images.thumbnail;
  
  return {
    title: `${product.title} - Art Shop`,
    description: product.description,
    openGraph: {
      title: product.title,
      description: product.description,
      images: [
        {
          url: mainImage,
          width: 1200,
          height: 630,
          alt: product.title,
        },
      ],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: product.title,
      description: product.description,
      images: [mainImage],
    },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { id } = await params;
  const product = getProductById(id);
  
  if (!product) {
    notFound();
  }
  
  return <ProductPageClient product={product} />;
}