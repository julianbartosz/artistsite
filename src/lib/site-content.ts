import 'server-only';
import { revalidatePath, unstable_noStore as noStore } from 'next/cache';
import { getConfig, setConfigMany } from '@/lib/config';
import { getCmsPreviewSnapshot, mergePreviewPageContent } from '@/lib/cms-preview';
import { sanitizeRichHtml } from '@/lib/content-sanitize';
import {
  SITE_CONTENT_KEYS,
  PAGE_SCHEMAS,
  SITE_CONTENT_DEFAULTS,
  isMeaningfulSiteText,
  type SiteContentPage,
  type BioPageContent,
  type ContactPageContent,
  type ShopPageContent,
  type SiteContentByPage,
} from '@/lib/site-content-shared';

export * from '@/lib/site-content-shared';

export function sanitizeSiteContentHtmlFields(page: SiteContentPage, content: unknown) {
  if (page === 'identity') {
    const identity = content as SiteContentByPage['identity'];
    return {
      ...identity,
      footer: {
        ...identity.footer,
        extraColumn: {
          ...identity.footer.extraColumn,
          bodyHtml: sanitizeRichHtml(identity.footer.extraColumn.bodyHtml),
        },
      },
    };
  }

  if (page === 'bio') {
    const bio = content as BioPageContent;
    return {
      ...bio,
      artistStatementHtml: sanitizeRichHtml(bio.artistStatementHtml),
      backgroundHtml: sanitizeRichHtml(bio.backgroundHtml),
      achievementsHtml: sanitizeRichHtml(bio.achievementsHtml),
      studioPracticeHtml: sanitizeRichHtml(bio.studioPracticeHtml),
      collectionsHtml: sanitizeRichHtml(bio.collectionsHtml),
    };
  }

  if (page === 'contact') {
    const contact = content as ContactPageContent;
    return {
      ...contact,
      sidebar: {
        ...contact.sidebar,
        responseTimeHtml: sanitizeRichHtml(contact.sidebar.responseTimeHtml),
        commissionHtml: sanitizeRichHtml(contact.sidebar.commissionHtml),
      },
    };
  }

  if (page === 'shop') {
    const shop = content as ShopPageContent;
    return {
      ...shop,
      successNextStepsHtml: sanitizeRichHtml(shop.successNextStepsHtml),
    };
  }

  return content;
}

export function mergePageContent(defaults: unknown, parsed: unknown): unknown {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return defaults;
  if (!defaults || typeof defaults !== 'object' || Array.isArray(defaults)) return parsed;

  const merged: Record<string, unknown> = { ...(defaults as Record<string, unknown>) };
  for (const [key, incoming] of Object.entries(parsed as Record<string, unknown>)) {
    const existing = merged[key];
    if (
      incoming &&
      typeof incoming === 'object' &&
      !Array.isArray(incoming) &&
      existing &&
      typeof existing === 'object' &&
      !Array.isArray(existing)
    ) {
      merged[key] = mergePageContent(existing, incoming);
    } else if (incoming !== undefined) {
      if (
        typeof incoming === 'string' &&
        typeof existing === 'string' &&
        incoming.trim().length > 0 &&
        !isMeaningfulSiteText(incoming)
      ) {
        continue;
      }
      merged[key] = incoming;
    }
  }
  return merged;
}

function parseStoredContent<T extends SiteContentPage>(page: T, raw: string | undefined): SiteContentByPage[T] {
  const schema = PAGE_SCHEMAS[page];
  const defaults = SITE_CONTENT_DEFAULTS[page];

  if (!raw) return defaults;

  try {
    const parsed = JSON.parse(raw);
    return schema.parse(mergePageContent(defaults, parsed)) as SiteContentByPage[T];
  } catch {
    return defaults;
  }
}

/** Saved content only, never an admin's unsaved preview snapshot. Use for emails and background jobs. */
export async function getPublishedSiteContent<T extends SiteContentPage>(page: T): Promise<SiteContentByPage[T]> {
  return parseStoredContent(page, await getConfig(SITE_CONTENT_KEYS[page]));
}

export async function getSiteContent<T extends SiteContentPage>(page: T): Promise<SiteContentByPage[T]> {
  noStore();
  const persisted = await getPublishedSiteContent(page);
  const previewSnapshot = await getCmsPreviewSnapshot();
  return mergePreviewPageContent(page, persisted, previewSnapshot);
}

export function revalidateSiteContent(page: SiteContentPage): void {
  if (page === 'identity') {
    revalidatePath('/', 'layout');
    return;
  }

  const paths: Record<Exclude<SiteContentPage, 'identity'>, string> = {
    home: '/',
    bio: '/bio',
    contact: '/contact',
    portfolio: '/portfolio',
    shop: '/shop',
    blog: '/blog',
  };

  revalidatePath(paths[page]);
  if (page === 'blog') revalidatePath('/updates');
  revalidatePath('/', 'layout');
}

/** Validates every page before writing any, then persists them in one transaction. */
export async function setSiteContentPages(
  pages: Partial<Record<SiteContentPage, unknown>>,
): Promise<Partial<SiteContentByPage>> {
  const entries = (Object.keys(pages) as SiteContentPage[]).map((page) => {
    const parsed = PAGE_SCHEMAS[page].parse(pages[page]);
    return [page, sanitizeSiteContentHtmlFields(page, parsed)] as const;
  });

  await setConfigMany(entries.map(([page, value]) => ({
    key: SITE_CONTENT_KEYS[page],
    value: JSON.stringify(value),
  })));
  for (const [page] of entries) revalidateSiteContent(page);

  return Object.fromEntries(entries) as Partial<SiteContentByPage>;
}

export async function getAllPublicSiteContent() {
  const [identity, home, bio, contact, portfolio, shop, blog] = await Promise.all([
    getSiteContent('identity'),
    getSiteContent('home'),
    getSiteContent('bio'),
    getSiteContent('contact'),
    getSiteContent('portfolio'),
    getSiteContent('shop'),
    getSiteContent('blog'),
  ]);

  return { identity, home, bio, contact, portfolio, shop, blog };
}

/** Studio editor must always hydrate from published truth, never an unsaved preview snapshot. */
export async function getAllAdminSiteContent() {
  const [identity, home, bio, contact, portfolio, shop, blog] = await Promise.all([
    getPublishedSiteContent('identity'),
    getPublishedSiteContent('home'),
    getPublishedSiteContent('bio'),
    getPublishedSiteContent('contact'),
    getPublishedSiteContent('portfolio'),
    getPublishedSiteContent('shop'),
    getPublishedSiteContent('blog'),
  ]);

  return { identity, home, bio, contact, portfolio, shop, blog };
}
