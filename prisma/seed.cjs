const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const { marked } = require('marked');

const prisma = new PrismaClient();
const root = path.resolve(__dirname, '..');

/** Mirrors src/lib/markdown-to-html.ts — keep marked options identical. */
function markdownToHtml(markdown) {
  const raw = String(markdown || '').trim();
  if (!raw) return '<p></p>';
  return marked.parse(raw, { async: false, gfm: true, breaks: false });
}

function existingPublicImageOrFallback(imagePath, fallback = '/images/fallback-artwork.svg') {
  if (!imagePath || typeof imagePath !== 'string') return fallback;
  if (!imagePath.startsWith('/')) return imagePath;

  const publicPath = path.join(root, 'public', imagePath.replace(/^\//, ''));
  return fs.existsSync(publicPath) ? imagePath : fallback;
}

function normalizeArtworkImages(images = {}) {
  const main = existingPublicImageOrFallback(images.main || images.thumbnail);
  const thumbnail = existingPublicImageOrFallback(images.thumbnail || main, main);
  const gallery = Array.isArray(images.gallery)
    ? images.gallery.map((image) => existingPublicImageOrFallback(image, main))
    : [];

  return {
    main,
    thumbnail,
    gallery: gallery.length ? gallery : [main],
  };
}

async function seedProducts() {
  const productsPath = path.join(root, 'src', 'content', 'shop', 'products.json');
  if (!fs.existsSync(productsPath)) return;

  const products = JSON.parse(fs.readFileSync(productsPath, 'utf8'));
  for (const product of products) {
    await prisma.product.upsert({
      where: { id: product.id },
      create: {
        id: product.id,
        slug: product.slug || product.id,
        title: product.title,
        description: product.description || '',
        price: Number(product.price || 0),
        currency: product.currency || 'USD',
        category: product.category || 'artwork',
        medium: product.medium || 'Mixed Media',
        dimensions: product.dimensions || '',
        year: Number(product.year || new Date().getFullYear()),
        availability: product.availability || 'available',
        featured: Boolean(product.featured),
        images: product.images || { thumbnail: '', gallery: [] },
        tags: product.tags || [],
        shipping: product.shipping || { domestic: 0, international: 0 },
        specifications: product.specifications || { framed: false, signed: false, certificate: false },
        variants: product.variants,
        customizations: product.customizations,
        relatedProducts: product.relatedProducts,
        bundle: product.bundle,
        commissionInfo: product.commissionInfo,
        edition: product.edition || null,
      },
      update: {
        slug: product.slug || product.id,
        title: product.title,
        description: product.description || '',
        price: Number(product.price || 0),
        currency: product.currency || 'USD',
        category: product.category || 'artwork',
        medium: product.medium || 'Mixed Media',
        dimensions: product.dimensions || '',
        year: Number(product.year || new Date().getFullYear()),
        availability: product.availability || 'available',
        featured: Boolean(product.featured),
        images: product.images || { thumbnail: '', gallery: [] },
        tags: product.tags || [],
        shipping: product.shipping || { domestic: 0, international: 0 },
        specifications: product.specifications || { framed: false, signed: false, certificate: false },
        variants: product.variants,
        customizations: product.customizations,
        relatedProducts: product.relatedProducts,
        bundle: product.bundle,
        commissionInfo: product.commissionInfo,
        edition: product.edition || null,
      },
    });

    const editionTotal = Number(product.edition?.total);
    const editionRemaining = Number(product.edition?.remaining);
    if (Number.isFinite(editionTotal) && editionTotal > 0) {
      // Limited editions are stock-tracked. Upsert both sides so re-seed restores demo stock
      // instead of leaving a prior admin edit (e.g. stock 0 → catalog "sold") in place.
      const startingStock = Number.isFinite(editionRemaining)
        ? Math.max(0, Math.min(editionTotal, Math.floor(editionRemaining)))
        : Math.floor(editionTotal);
      const lowStockThreshold = Math.max(1, Math.min(5, Math.floor(editionTotal / 10) || 1));
      const stockStatus = startingStock === 0 ? 'out_of_stock' : startingStock <= lowStockThreshold ? 'low_stock' : 'in_stock';
      await prisma.productInventory.upsert({
        where: { productId: product.id },
        create: {
          productId: product.id,
          currentStock: startingStock,
          reservedStock: 0,
          availableStock: startingStock,
          lowStockThreshold,
          stockStatus,
          isTrackingEnabled: true,
          allowBackorders: false,
        },
        update: {
          currentStock: startingStock,
          reservedStock: 0,
          availableStock: startingStock,
          lowStockThreshold,
          stockStatus,
          isTrackingEnabled: true,
          allowBackorders: false,
        },
      });
    } else {
      // One-of-a-kind catalog items stay untracked (null inventory ⇒ purchasable while available).
      // Clear any leftover tracking row from Studio edits so re-seed matches that contract.
      await prisma.productInventory.deleteMany({ where: { productId: product.id } });
    }
  }
}

async function seedBlogPosts() {
  const blogDir = path.join(root, 'src', 'content', 'blog');
  if (!fs.existsSync(blogDir)) return;

  for (const filename of fs.readdirSync(blogDir).filter((file) => file.endsWith('.mdx'))) {
    const slug = filename.replace(/\.mdx$/, '');
    const source = fs.readFileSync(path.join(blogDir, filename), 'utf8');
    const { data, content } = matter(source);

    await prisma.blogPost.upsert({
      where: { slug },
      create: {
        slug,
        title: data.title || 'Untitled',
        excerpt: data.excerpt || '',
        content: markdownToHtml(content),
        publishedAt: data.publishedAt ? new Date(data.publishedAt) : new Date(),
        tags: data.tags || [],
        isDraft: Boolean(data.isDraft),
        coverImage: data.coverImage,
        author: data.author || 'Artist',
      },
      update: {
        title: data.title || 'Untitled',
        excerpt: data.excerpt || '',
        content: markdownToHtml(content),
        publishedAt: data.publishedAt ? new Date(data.publishedAt) : new Date(),
        tags: data.tags || [],
        isDraft: Boolean(data.isDraft),
        coverImage: data.coverImage,
        author: data.author || 'Artist',
      },
    });
  }
}

async function seedArtworks() {
  const portfolioDir = path.join(root, 'src', 'content', 'portfolio');
  if (!fs.existsSync(portfolioDir)) return;

  for (const filename of fs.readdirSync(portfolioDir).filter((file) => file.endsWith('.mdx'))) {
    const slug = filename.replace(/\.mdx$/, '');
    const source = fs.readFileSync(path.join(portfolioDir, filename), 'utf8');
    const { data, content } = matter(source);

    await prisma.artwork.upsert({
      where: { slug },
      create: {
        slug,
        title: data.title || 'Untitled',
        description: data.description || '',
        medium: data.medium || 'Mixed Media',
        dimensions: data.dimensions || '',
        year: String(data.year || new Date().getFullYear()),
        category: data.category || ['uncategorized'],
        featured: Boolean(data.featured),
        available: Boolean(data.available),
        price: data.price,
        images: normalizeArtworkImages(data.images),
        content: markdownToHtml(content),
      },
      update: {
        title: data.title || 'Untitled',
        description: data.description || '',
        medium: data.medium || 'Mixed Media',
        dimensions: data.dimensions || '',
        year: String(data.year || new Date().getFullYear()),
        category: data.category || ['uncategorized'],
        featured: Boolean(data.featured),
        available: Boolean(data.available),
        price: data.price,
        images: normalizeArtworkImages(data.images),
        content: markdownToHtml(content),
      },
    });
  }
}


/** Mirror src/lib/site-content-shared normalizePortfolioCategoryKey (no regex). */
function normalizePortfolioCategoryKey(value) {
  const lower = String(value || '').trim().toLowerCase();
  const chars = [];
  let pendingHyphen = false;
  for (const char of lower) {
    const isAlphaNum = (char >= 'a' && char <= 'z') || (char >= '0' && char <= '9');
    if (isAlphaNum) {
      if (pendingHyphen && chars.length > 0) chars.push('-');
      chars.push(char);
      pendingHyphen = false;
    } else if (chars.length > 0) {
      pendingHyphen = true;
    }
  }
  return chars.join('') || 'category';
}

function humanizeCategoryLabel(value) {
  const parts = [];
  let current = '';
  for (const char of String(value || '')) {
    if (char === '-' || char === '_' || char === ' ') {
      if (current) {
        parts.push(current);
        current = '';
      }
      continue;
    }
    current += char;
  }
  if (current) parts.push(current);
  return parts.map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ') || value;
}

/**
 * First-run demo only: curated portfolio filters from seeded artwork tags.
 * Skips when PAGE_PORTFOLIO_JSON already exists so Studio edits are preserved.
 */
async function seedPortfolioPageContent() {
  const key = 'PAGE_PORTFOLIO_JSON';
  const existing = await prisma.siteSetting.findUnique({ where: { key } });
  if (existing) return;

  const artworks = await prisma.artwork.findMany({ select: { category: true } });
  const seen = new Set();
  const categories = [];
  for (const artwork of artworks) {
    const tags = Array.isArray(artwork.category) ? artwork.category : [];
    for (const tag of tags) {
      const normalized = normalizePortfolioCategoryKey(tag);
      if (!normalized || normalized === 'category' || normalized === 'uncategorized' || seen.has(normalized)) {
        continue;
      }
      seen.add(normalized);
      categories.push({ key: normalized, label: humanizeCategoryLabel(normalized), visible: true });
    }
  }
  categories.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));

  await prisma.siteSetting.create({
    data: {
      key,
      encrypted: false,
      value: JSON.stringify({
        title: 'Portfolio',
        subtitle: '',
        hero: { height: 'compact' },
        layout: {
          gridColumns: '3',
          showFilters: true,
          masonry: false,
          imageFit: 'cover',
          thumbAspect: 'square',
          showFeaturedBadge: true,
          showSoldBadge: true,
          showMeta: true,
          showPrice: false,
          includeUnlistedCategories: false,
        },
        categories,
        artworkDetailLayout: 'standard',
      }),
    },
  });
}

function productSnapshotFromRecord(product) {
  const images = product?.images && typeof product.images === 'object' ? product.images : {};
  const thumbnail = existingPublicImageOrFallback(images.thumbnail || images.main);
  return {
    productTitle: product?.title || 'Artwork',
    productImage: thumbnail,
    productPrice: product?.price ?? 0,
  };
}

async function seedDemoCustomer() {
  const bcrypt = require('bcryptjs');
  const email = 'buyer@example.com';
  const passwordHash = await bcrypt.hash('CustomerPass123!', 12);

  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      password: passwordHash,
      firstName: 'Alex',
      lastName: 'Buyer',
      name: 'Alex Buyer',
      phone: '555-0100',
    },
    update: {
      firstName: 'Alex',
      lastName: 'Buyer',
      name: 'Alex Buyer',
      phone: '555-0100',
    },
  });

  const demoProductId = 'oil-painting-urban-twilight';
  const product = await prisma.product.findUnique({ where: { id: demoProductId } });
  const { productTitle, productImage, productPrice } = productSnapshotFromRecord(product);

  await prisma.wishlistItem.upsert({
    where: { userId_productId: { userId: user.id, productId: demoProductId } },
    create: {
      userId: user.id,
      productId: demoProductId,
      productTitle,
      productImage,
      productPrice,
    },
    update: {
      productTitle,
      productImage,
      productPrice,
    },
  });

  const demoShipping = {
    firstName: 'Alex',
    lastName: 'Buyer',
    address1: '123 Collector Lane',
    city: 'Brooklyn',
    state: 'NY',
    postalCode: '11201',
    country: 'US',
    phone: '555-0100',
  };

  let shippingAddress = await prisma.address.findFirst({
    where: {
      userId: user.id,
      type: 'shipping',
      address1: demoShipping.address1,
    },
  });

  if (!shippingAddress) {
    shippingAddress = await prisma.address.create({
      data: {
        userId: user.id,
        type: 'shipping',
        isDefault: true,
        ...demoShipping,
      },
    });
  }

  const existingOrder = await prisma.order.findFirst({ where: { userId: user.id } });
  if (!existingOrder) {
    await prisma.order.create({
      data: {
        orderNumber: 'ORD-DEMO-1001',
        userId: user.id,
        userEmail: user.email,
        status: 'processing',
        type: 'standard',
        subtotal: productPrice,
        shipping: 45,
        tax: Math.round(productPrice * 0.08),
        total: productPrice + 45 + Math.round(productPrice * 0.08),
        paymentStatus: 'paid',
        paymentMethod: 'card',
        shippingAddressId: shippingAddress.id,
        items: {
          create: [{
            productId: demoProductId,
            quantity: 1,
            unitPrice: productPrice,
            totalPrice: productPrice,
            productTitle,
            productImage,
          }],
        },
        timeline: {
          create: [{ status: 'processing', message: 'Order confirmed and being prepared.' }],
        },
      },
    });
  } else if (!existingOrder.shippingAddressId) {
    await prisma.order.update({
      where: { id: existingOrder.id },
      data: { shippingAddressId: shippingAddress.id },
    });
  }
}

async function main() {
  await seedProducts();
  await seedBlogPosts();
  await seedArtworks();
  await seedPortfolioPageContent();
  await seedDemoCustomer();
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });