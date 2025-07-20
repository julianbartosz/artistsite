import React from 'react';

interface MDXContentProps {
  code: string;
}

export function MDXContent({ code }: MDXContentProps) {
  // For now, render the content as HTML to avoid React version conflicts
  // This is a simplified approach to get the build working
  return (
    <div 
      className="prose prose-lg max-w-none"
      dangerouslySetInnerHTML={{ __html: code }} 
    />
  );
}