'use client';

import { useRouter } from 'next/navigation';

export function PreviewBanner() {
  const router = useRouter();

  const exitPreview = async () => {
    const response = await fetch('/api/preview', {
      method: 'DELETE',
    });
    
    if (response.ok) {
      router.refresh();
    }
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-400 text-black px-4 py-2 text-center text-sm font-medium shadow-md">
      <div className="flex items-center justify-center gap-4">
        <span>
          🚧 <strong>Preview Mode Active</strong> - You are viewing draft content
        </span>
        <button
          onClick={exitPreview}
          className="bg-black text-yellow-400 px-3 py-1 rounded text-xs hover:bg-gray-800 transition-colors"
        >
          Exit Preview
        </button>
      </div>
    </div>
  );
}