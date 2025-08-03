'use client';

import React, { useMemo } from 'react';
import { getMDXComponent } from 'mdx-bundler/client';

interface MDXContentProps {
  code: string;
}

export function MDXContent({ code }: MDXContentProps) {
  const Component = useMemo(() => {
    try {
      return getMDXComponent(code);
    } catch {
      const ErrorComponent = () => (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-800">Error rendering content. Please try refreshing the page.</p>
        </div>
      );
      ErrorComponent.displayName = 'MDXErrorComponent';
      return ErrorComponent;
    }
  }, [code]);

  return (
    <div className="prose prose-lg max-w-none">
      <Component />
    </div>
  );
}

MDXContent.displayName = 'MDXContent';