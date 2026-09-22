import 'server-only';

import { cookies } from 'next/headers';
import { getConfig, setConfig } from '@/lib/config';
import {
  PAGE_SCHEMAS,
  SITE_CONTENT_DEFAULTS,
  type SiteContentByPage,
  type SiteContentPage,
} from '@/lib/site-content-shared';

export const CMS_PREVIEW_CONFIG_KEY = 'CMS_PREVIEW_SNAPSHOT';
export const CMS_PREVIEW_COOKIE = 'cms-preview';

export async function isCmsPreviewActive(): Promise<boolean> {
  const cookieStore = await cookies();
  return cookieStore.get(CMS_PREVIEW_COOKIE)?.value === '1';
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
    return schema.parse({ ...defaults, ...persisted, ...draft }) as SiteContentByPage[T];
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
