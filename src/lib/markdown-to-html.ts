import { marked } from 'marked';

/**
 * Convert markdown at content ingress (seed/import) into HTML for TipTap/HTML storage.
 * Public pages always render sanitized HTML — they do not parse markdown at request time.
 */
export function markdownToHtml(markdown: string): string {
  const raw = String(markdown || '').trim();
  if (!raw) return '<p></p>';
  return marked.parse(raw, { async: false, gfm: true, breaks: false }) as string;
}
