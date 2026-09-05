import sanitizeHtml from 'sanitize-html';
import { visibleHtmlText } from '@/lib/site-content-shared';

export function htmlHasVisibleText(html: string): boolean {
  return visibleHtmlText(html).length > 0;
}

/** Remove a leading h1 when it repeats the page title already shown in the layout header. */
export function stripLeadingDuplicateHeading(html: string, title: string): string {
  const trimmedHtml = html.trimStart();
  const normalizedTitle = title.trim().toLowerCase();
  if (!normalizedTitle || !trimmedHtml.toLowerCase().startsWith('<h1')) {
    return html;
  }

  const closeIndex = trimmedHtml.toLowerCase().indexOf('</h1>');
  if (closeIndex === -1) {
    return html;
  }

  const openingTagEnd = trimmedHtml.indexOf('>');
  if (openingTagEnd === -1 || openingTagEnd > closeIndex) {
    return html;
  }

  const innerHtml = trimmedHtml.slice(openingTagEnd + 1, closeIndex);
  if (visibleHtmlText(innerHtml).toLowerCase() !== normalizedTitle) {
    return html;
  }

  return trimmedHtml.slice(closeIndex + 5).trimStart();
}

export function sanitizeRichHtml(html: string): string {
  return sanitizeHtml(html || '', {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
      'img', 'h1', 'h2', 'h3', 'h4', 'figure', 'figcaption', 'span', 'u', 's'
    ]),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      a: ['href', 'name', 'target', 'rel'],
      img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
      span: ['class'],
      '*': ['class'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }, true),
      img: (tagName, attribs) => ({
        tagName,
        attribs: {
          ...attribs,
          loading: attribs.loading || 'lazy',
        },
      }),
    },
  });
}