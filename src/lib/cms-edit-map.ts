import type { SiteContentPage } from '@/lib/site-content-shared';

export type CmsEditTarget = {
  adminTab: 'pages' | 'products' | 'portfolio' | 'posts' | 'settings';
  page?: SiteContentPage;
  section?: string;
  label: string;
};

export const CMS_EDIT_TARGETS: Record<string, CmsEditTarget> = {
  'home:hero': { adminTab: 'pages', page: 'home', section: 'hero', label: 'Edit top banner' },
  'home:featured': { adminTab: 'pages', page: 'home', section: 'featured', label: 'Edit artwork spotlight' },
  'home:about': { adminTab: 'pages', page: 'home', section: 'about', label: 'Edit about preview' },
  'home:blog': { adminTab: 'pages', page: 'home', section: 'blog', label: 'Edit updates preview' },
  'home:newsletter': { adminTab: 'pages', page: 'home', section: 'newsletter', label: 'Edit newsletter' },
  'bio:hero': { adminTab: 'pages', page: 'bio', section: 'hero', label: 'Edit page header' },
  'bio:statement': { adminTab: 'pages', page: 'bio', section: 'statement', label: 'Edit artist statement' },
  'bio:studio': { adminTab: 'pages', page: 'bio', section: 'studio', label: 'Edit studio section' },
  'bio:background': { adminTab: 'pages', page: 'bio', section: 'background', label: 'Edit background' },
  'bio:collections': { adminTab: 'pages', page: 'bio', section: 'collections', label: 'Edit collections' },
  'bio:cta': { adminTab: 'pages', page: 'bio', section: 'cta', label: 'Edit closing section' },
  'contact:header': { adminTab: 'pages', page: 'contact', section: 'header', label: 'Edit contact page' },
  'contact:sidebar': { adminTab: 'pages', page: 'contact', section: 'sidebar', label: 'Edit contact sidebar' },
  'portfolio:listing': { adminTab: 'pages', page: 'portfolio', section: 'listing', label: 'Edit portfolio page' },
  'shop:listing': { adminTab: 'pages', page: 'shop', section: 'listing', label: 'Edit shop page' },
  'shop:purchase': { adminTab: 'pages', page: 'shop', section: 'purchase', label: 'Edit purchase information' },
  'shop:checkout': { adminTab: 'pages', page: 'shop', section: 'checkout', label: 'Edit checkout copy' },
  'blog:listing': { adminTab: 'pages', page: 'blog', section: 'listing', label: 'Edit updates page' },
  'identity:branding': { adminTab: 'pages', page: 'identity', section: 'branding', label: 'Edit look & feel' },
  'identity:footer': { adminTab: 'pages', page: 'identity', section: 'footer', label: 'Edit footer' },
  'identity:navigation': { adminTab: 'pages', page: 'identity', section: 'navigation', label: 'Edit navigation' },
  'identity:legal': { adminTab: 'pages', page: 'identity', section: 'legal', label: 'Edit legal pages' },
  products: { adminTab: 'products', label: 'Manage products' },
  portfolio: { adminTab: 'portfolio', label: 'Manage portfolio' },
  posts: { adminTab: 'posts', label: 'Manage updates' },
};

export function cmsEditHref(targetKey: string): string {
  const target = CMS_EDIT_TARGETS[targetKey];
  if (!target) return '/admin?tab=pages';

  const params = new URLSearchParams({ tab: target.adminTab });
  if (target.page) params.set('page', target.page);
  if (target.section) params.set('section', target.section);
  return `/admin?${params.toString()}`;
}

export function cmsSectionElementId(page: SiteContentPage, section: string): string {
  return `cms-section-${page}-${section}`;
}
