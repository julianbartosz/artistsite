import 'server-only';
import { revalidatePath, unstable_noStore as noStore } from 'next/cache';
import { getConfig, setConfig } from '@/lib/config';
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
  type SiteContentByPage,
} from '@/lib/site-content-shared';

export * from '@/lib/site-content-shared';

function sanitizeHtmlFields(page: SiteContentPage, content: unknown) {
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

  return content;
}

function mergePageContent(defaults: unknown, parsed: unknown): unknown {
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

export async function getSiteContent<T extends SiteContentPage>(page: T): Promise<SiteContentByPage[T]> {
  noStore();
  const raw = await getConfig(SITE_CONTENT_KEYS[page]);
  const persisted = parseStoredContent(page, raw);
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

export async function setSiteContent<T extends SiteContentPage>(page: T, content: unknown) {
  const schema = PAGE_SCHEMAS[page];
  const parsed = schema.parse(content);
  const sanitized = sanitizeHtmlFields(page, parsed);
  await setConfig(SITE_CONTENT_KEYS[page], JSON.stringify(sanitized));
  revalidateSiteContent(page);
  return sanitized;
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

export async function getAllAdminSiteContent() {
  return getAllPublicSiteContent();
}
