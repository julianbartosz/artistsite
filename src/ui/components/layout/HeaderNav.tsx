import Link from 'next/link';

export type NavItem = { name: string; href: string };

export function HeaderNav({ items, isActive }: { items: NavItem[]; isActive: (href: string) => boolean }) {
  return (
    <div className="hidden md:block">
      <div className="ml-10 flex items-baseline space-x-8">
        {items.map((item) => (
          <Link
            key={item.name}
            href={item.href}
            className={`px-3 py-2 text-sm font-medium transition-colors ${
              isActive(item.href)
                ? 'text-gray-900 border-b-2 border-gray-900'
                : 'text-gray-600 hover:text-gray-900 hover:border-b-2 hover:border-gray-300'
            }`}
          >
            {item.name}
          </Link>
        ))}
      </div>
    </div>
  );
}
