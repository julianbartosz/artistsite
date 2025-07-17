'use client';

import { getMDXComponent } from 'mdx-bundler/client';
import { useMemo } from 'react';

interface MDXContentProps {
  code: string;
}

export function MDXContent({ code }: MDXContentProps) {
  const Component = useMemo(() => getMDXComponent(code), [code]);
  return <Component />;
}