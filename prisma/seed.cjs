const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

const prisma = new PrismaClient();
const root = path.resolve(__dirname, '..');

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function markdownToHtml(markdown) {
  const blocks = String(markdown || '')
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  if (blocks.length === 0) return '<p></p>';

  return blocks.map((block) => {
    if (block.startsWith('### ')) return `<h3>${escapeHtml(block.slice(4))}</h3>`;
    if (block.startsWith('## ')) return `<h2>${escapeHtml(block.slice(3))}</h2>`;
    if (block.startsWith('# ')) return `<h1>${escapeHtml(block.slice(2))}</h1>`;
    return `<p>${escapeHtml(block).replace(/\n/g, '<br />')}</p>`;
  }).join('\n');
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
      },
    });
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
  await seedDemoCustomer();
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });