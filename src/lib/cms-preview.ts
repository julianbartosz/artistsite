import 'server-only';

import { cookies } from 'next/headers';
import { getConfig, setConfig } from '@/lib/config';
import { sanitizeRichHtml } from '@/lib/content-sanitize';
import {
  PAGE_SCHEMAS,
  SITE_CONTENT_DEFAULTS,
  type BioPageContent,
  type ContactPageContent,
  type ShopPageContent,
  type SiteContentByPage,
  type SiteContentPage,
} from '@/lib/site-content-shared';

export const CMS_PREVIEW_CONFIG_KEY = 'CMS_PREVIEW_SNAPSHOT';
export const CMS_PREVIEW_COOKIE = 'cms-preview';

function deepMergePreview(base: unknown, override: unknown): unknown {
  if (!override || typeof override !== 'object' || Array.isArray(override)) return override ?? base;
  if (!base || typeof base !== 'object' || Array.isArray(base)) return override;
  const merged: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [key, value] of Object.entries(override as Record<string, unknown>)) {
    if (value === undefined) continue;
    const existing = merged[key];
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      existing &&
      typeof existing === 'object' &&
      !Array.isArray(existing)
    ) {
      merged[key] = deepMergePreview(existing, value);
    } else {
      merged[key] = value;
    }
  }
  return merged;
}

function sanitizePreviewHtml<T extends SiteContentPage>(page: T, parsed: SiteContentByPage[T]): SiteContentByPage[T] {
  if (page === 'identity') {
    const identity = parsed as SiteContentByPage['identity'];
    return {
      ...identity,
      footer: {
        ...identity.footer,
        extraColumn: {
          ...identity.footer.extraColumn,
          bodyHtml: sanitizeRichHtml(identity.footer.extraColumn.bodyHtml),
        },
      },
    } as SiteContentByPage[T];
  }
  if (page === 'bio') {
    const bio = parsed as BioPageContent;
    return {
      ...bio,
      artistStatementHtml: sanitizeRichHtml(bio.artistStatementHtml),
      backgroundHtml: sanitizeRichHtml(bio.backgroundHtml),
      achievementsHtml: sanitizeRichHtml(bio.achievementsHtml),
      studioPracticeHtml: sanitizeRichHtml(bio.studioPracticeHtml),
      collectionsHtml: sanitizeRichHtml(bio.collectionsHtml),
    } as SiteContentByPage[T];
  }
  if (page === 'contact') {
    const contact = parsed as ContactPageContent;
    return {
      ...contact,
      sidebar: {
        ...contact.sidebar,
        responseTimeHtml: sanitizeRichHtml(contact.sidebar.responseTimeHtml),
        commissionHtml: sanitizeRichHtml(contact.sidebar.commissionHtml),
      },
    } as SiteContentByPage[T];
  }
  if (page === 'shop') {
    const shop = parsed as ShopPageContent;
    return {
      ...shop,
      successNextStepsHtml: sanitizeRichHtml(shop.successNextStepsHtml),
    } as SiteContentByPage[T];
  }
  return parsed;
}

export async function isCmsPreviewActive(): Promise<boolean> {
  const cookieStore = await cookies();
  if (cookieStore.get(CMS_PREVIEW_COOKIE)?.value !== '1') return false;
  const [{ getServerSession }, { authOptions }] = await Promise.all([
    import('next-auth'),
    import('@/lib/auth'),
  ]);
  const session = await getServerSession(authOptions);
  return Boolean(session?.user?.isAdmin);
}

export async function getCmsPreviewSnapshot(): Promise<Partial<SiteContentByPage> | null> {
  if (!(await isCmsPreviewActive())) return null;

  const raw = await getConfig(CMS_PREVIEW_CONFIG_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<SiteContentByPage>;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function mergePreviewPageContent<T extends SiteContentPage>(
  page: T,
  persisted: SiteContentByPage[T],
  snapshot: Partial<SiteContentByPage> | null,
): SiteContentByPage[T] {
  const draft = snapshot?.[page];
  if (!draft) return persisted;

  const schema = PAGE_SCHEMAS[page];
  const defaults = SITE_CONTENT_DEFAULTS[page];
  try {
    const merged = deepMergePreview(deepMergePreview(defaults, persisted), draft);
    const parsed = schema.parse(merged) as SiteContentByPage[T];
    return sanitizePreviewHtml(page, parsed);
  } catch {
    return persisted;
  }
}

export async function setCmsPreviewSnapshot(content: SiteContentByPage): Promise<void> {
  await setConfig(CMS_PREVIEW_CONFIG_KEY, JSON.stringify(content));
}

export async function clearCmsPreviewSnapshot(): Promise<void> {
  await setConfig(CMS_PREVIEW_CONFIG_KEY, '');
}
