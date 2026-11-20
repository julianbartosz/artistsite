import React from 'react';
import { htmlHasVisibleText } from '@/lib/site-content-shared';

interface MDXContentProps {
  /** HTML body already sanitized at the content trust boundary (legacy prop name). */
  code: string;
  className?: string;
}

/**
 * Renders artwork/post HTML bodies. Storage is TipTap HTML; seed converts markdown → HTML at ingress.
 * Returns null for empty shells so detail pages can mount without a bolted-on empty card.
 */
export function MDXContent({ code, className = 'prose prose-lg max-w-none text-gray-700' }: MDXContentProps) {
  if (!htmlHasVisibleText(code)) {
    return null;
  }

  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: code }}
    />
  );
}
