#!/usr/bin/env node
/**
 * Export production artist content + page personalization + media to a local snapshot.
 * Usage: node --env-file=.env.fly scripts/snapshot-artist-uat.mjs [outDir]
 */
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';

const outRoot = process.argv[2] || process.env.SNAPSHOT_OUT;
if (!outRoot) {
  console.error('Pass outDir as argv or SNAPSHOT_OUT');
  process.exit(1);
}

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL(_UNPOOLED) required');
  process.exit(1);
}

const prisma = new PrismaClient({ datasources: { db: { url } } });
const jsonDir = path.join(outRoot, 'json');
const mediaDir = path.join(outRoot, 'media');
fs.mkdirSync(jsonDir, { recursive: true });
fs.mkdirSync(mediaDir, { recursive: true });

function writeJson(name, data) {
  fs.writeFileSync(path.join(jsonDir, name), JSON.stringify(data, null, 2));
  console.log('wrote', name, Array.isArray(data) ? `(${data.length})` : '');
}

function collectUrls(v, set = new Set()) {
  if (!v) return set;
  if (typeof v === 'string') {
    const matches = v.match(/https?:\/\/[^\s"'\\]+/g) || [];
    for (const u of matches) {
      if (u.includes('blob.core.windows.net')) set.add(u.replace(/[,)\\]]+$/, ''));
    }
    return set;
  }
  if (Array.isArray(v)) {
    v.forEach((x) => collectUrls(x, set));
    return set;
  }
  if (typeof v === 'object') Object.values(v).forEach((x) => collectUrls(x, set));
  return set;
}

function download(u, dest) {
  return new Promise((resolve, reject) => {
    const mod = u.startsWith('https') ? https : http;
    const file = fs.createWriteStream(dest);
    mod.get(u, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        fs.unlinkSync(dest);
        return download(res.headers.location, dest).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        file.close();
        try {
          fs.unlinkSync(dest);
        } catch {
          /* ignore */
        }
        return reject(new Error(`HTTP ${res.statusCode} for ${u}`));
      }
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve({ url: u, bytes: fs.statSync(dest).size })));
    }).on('error', (err) => {
      try {
        file.close();
        fs.unlinkSync(dest);
      } catch {
        /* ignore */
      }
      reject(err);
    });
  });
}

try {
  const users = await prisma.user.findMany();
  writeJson('users.json', users);
  writeJson(
    'users.redacted.json',
    users.map(({ password, ...rest }) => ({ ...rest, password: password ? '[REDACTED]' : null })),
  );

  const products = await prisma.product.findMany({ orderBy: { createdAt: 'asc' } });
  const artworks = await prisma.artwork.findMany({ orderBy: { createdAt: 'asc' } });
  const inventory = await prisma.productInventory.findMany();
  const movements = await prisma.stockMovement.findMany({ orderBy: { createdAt: 'asc' } });
  const settings = await prisma.siteSetting.findMany({ orderBy: { key: 'asc' } });
  const blogPosts = await prisma.blogPost.findMany().catch(() => []);

  writeJson('products.json', products);
  writeJson('artworks.json', artworks);
  writeJson('product-inventory.json', inventory);
  writeJson('stock-movements.json', movements);
  writeJson('site-settings.json', settings);
  writeJson('blog-posts.json', blogPosts);

  const pages = {};
  for (const s of settings) {
    if (s.key.endsWith('_JSON') || s.key === 'CMS_PREVIEW_SNAPSHOT') {
      try {
        pages[s.key] = JSON.parse(s.value);
      } catch {
        pages[s.key] = s.value;
      }
    }
  }
  writeJson('page-personalization.json', pages);

  const urls = new Set();
  for (const p of products) collectUrls(p.images, urls);
  for (const a of artworks) collectUrls(a.images, urls);
  for (const s of settings) if (!s.encrypted) collectUrls(s.value, urls);
  writeJson('media-urls.json', [...urls].sort());

  const mediaManifest = [];
  for (const u of [...urls].sort()) {
    const name = path.basename(new URL(u).pathname);
    const dest = path.join(mediaDir, name);
    try {
      const info = await download(u, dest);
      mediaManifest.push({ url: u, file: `media/${name}`, bytes: info.bytes, ok: true });
      console.log('downloaded', name, info.bytes);
    } catch (e) {
      mediaManifest.push({ url: u, file: `media/${name}`, ok: false, error: String(e.message || e) });
      console.error('FAILED', name, e.message || e);
    }
  }
  writeJson('media-manifest.json', mediaManifest);

  const summary = {
    createdAt: new Date().toISOString(),
    source: 'production Neon + Azure Blob (michalelena)',
    artistEmail: 'michalelenaart@gmail.com',
    snapshotDir: outRoot,
    counts: {
      users: users.length,
      products: products.length,
      artworks: artworks.length,
      inventory: inventory.length,
      stockMovements: movements.length,
      siteSettings: settings.length,
      mediaFiles: mediaManifest.filter((m) => m.ok).length,
      mediaFailed: mediaManifest.filter((m) => !m.ok).length,
    },
    productIds: products.map((p) => p.id),
    artworkSlugs: artworks.map((a) => a.slug),
    pageSettingKeys: Object.keys(pages),
  };
  writeJson('snapshot-summary.json', summary);
  console.log(JSON.stringify(summary, null, 2));
} finally {
  await prisma.$disconnect();
}
