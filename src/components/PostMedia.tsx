'use client';

import type { PostMediaItem } from '@/lib/admin-content';

type PostMediaProps = {
  items: PostMediaItem[];
  title: string;
  layout?: 'feed' | 'grid' | 'detail';
};

export default function PostMedia({ items, title, layout = 'feed' }: PostMediaProps) {
  if (items.length === 0) return null;

  if (layout === 'grid' && items[0]) {
    const item = items[0];
    return (
      <div className="relative aspect-square overflow-hidden bg-gray-100">
        {item.type === 'video' ? (
          <video
            src={item.url}
            poster={item.poster}
            className="h-full w-full object-cover"
            muted
            playsInline
            preload="metadata"
          />
        ) : (
          <img src={item.url} alt={item.alt || title} className="h-full w-full object-cover" />
        )}
        {item.type === 'video' && (
          <span className="absolute bottom-2 right-2 rounded bg-black/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
            Video
          </span>
        )}
        {items.length > 1 && (
          <span className="absolute right-2 top-2 rounded bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-white">
            {items.length}
          </span>
        )}
      </div>
    );
  }

  const frameClass = layout === 'detail'
    ? 'overflow-hidden rounded-lg bg-gray-100'
    : 'overflow-hidden rounded-xl bg-gray-100';

  return (
    <div className={items.length > 1 ? 'grid grid-cols-1 gap-2 sm:grid-cols-2' : undefined}>
      {items.map((item, index) => (
        <div key={`${item.url}-${index}`} className={frameClass}>
          {item.type === 'video' ? (
            <video
              src={item.url}
              poster={item.poster}
              className="aspect-[4/5] w-full object-cover sm:aspect-square"
              controls
              playsInline
              preload="metadata"
            />
          ) : (
            <img
              src={item.url}
              alt={item.alt || title}
              className="aspect-[4/5] w-full object-cover sm:aspect-square"
            />
          )}
        </div>
      ))}
    </div>
  );
}
