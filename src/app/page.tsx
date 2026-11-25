import type { Metadata } from "next";
import Link from "next/link";
import React from "react";
import { getAllPosts } from "@/lib/markdown";
import { resolveFeaturedArtworks } from "@/lib/portfolio";
import { getSiteContent } from "@/lib/site-content";
import { getPublicSiteShell } from "@/lib/public-site-shell";
import { getSiteUrl } from "@/lib/config";
import { socialHandle } from "@/lib/seo";
import { StructuredData, generateWebSiteSchema } from "@/components/StructuredData";
import {
  homeHeroCtas,
  homeHeroHeightClass,
  homeHeroImagePositionClass,
  gridColumnsClass,
  resolveHomeSectionRenderPlan,
  splitPlainParagraphs,
  UPDATES_PATH,
  updatesPostPath,
  type HomePageContent,
  type HomeSectionKey,
} from "@/lib/site-content-shared";
import type { ArtworkPiece } from "@/lib/portfolio";
import type { BlogPost } from "@/lib/markdown";
import { NewsletterSignup } from "@/components/NewsletterSignup";
import CmsEditAnchor from "@/components/admin/CmsEditAnchor";
import ImageCarousel from "@/components/ImageCarousel";
import OptimizedImage from "@/components/OptimizedImage";
import { artworkGalleryImages, collectImageGallery } from "@/lib/commerce";

export const dynamic = 'force-dynamic';

function buildHomeMetaDescription(tagline: string, heroSubtitle: string, aboutBody: string): string | undefined {
  const parts = [tagline, heroSubtitle, splitPlainParagraphs(aboutBody)[0] ?? '']
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (parts.length === 0) return undefined;

  const unique: string[] = [];
  for (const part of parts) {
    if (!unique.some((existing) => existing.toLowerCase() === part.toLowerCase())) {
      unique.push(part);
    }
  }
  const combined = unique.join(' — ');
  return combined.length > 160 ? `${combined.slice(0, 157).trimEnd()}…` : combined;
}

function deriveSiteAlternateNames(siteUrl: string, socialUrls: Record<string, string>): string[] {
  const candidates: string[] = [];
  try {
    const hostname = new URL(siteUrl).hostname.replace(/^www\./, '');
    if (hostname && hostname !== 'localhost') {
      candidates.push(hostname);
    }
  } catch {
    // Ignore invalid siteUrl
  }
  for (const profileUrl of Object.values(socialUrls)) {
    const handle = socialHandle(profileUrl);
    if (handle) {
      const bare = handle.replace(/^@/, '');
      if (bare) candidates.push(bare);
    }
  }
  return candidates;
}

export async function generateMetadata(): Promise<Metadata> {
  const [{ identity, socialUrls }, home] = await Promise.all([
    getPublicSiteShell(),
    getSiteContent('home'),
  ]);
  const siteName = identity.siteName.trim();
  const tagline = identity.tagline.trim();
  const titleText = tagline ? `${siteName} — ${tagline}` : `${siteName} — Original Art & Portfolio`;
  const description = buildHomeMetaDescription(tagline, home.hero.subtitle, home.about.paragraph1);
  const twitterHandle = socialHandle(socialUrls.twitter);

  return {
    title: { absolute: titleText },
    description,
    alternates: { canonical: '/' },
    openGraph: {
      type: 'website',
      locale: 'en_US',
      url: '/',
      siteName,
      title: titleText,
      description,
      images: [
        {
          url: '/api/og',
          width: 1200,
          height: 630,
          alt: siteName,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      site: twitterHandle,
      creator: twitterHandle,
      title: titleText,
      description,
      images: ['/api/og'],
    },
  };
}

/** Natural-width gallery CTA row: full-width tap targets on phones, balanced inline buttons on tablet/desktop. */
function heroCtaLayoutClass(inlineHero: boolean): string {
  return inlineHero
    ? 'flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3'
    : 'flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center sm:justify-center gap-3';
}

const primaryCtaClass = "btn-primary w-full sm:w-auto sm:min-w-[10rem] px-6 py-3 text-sm sm:text-base text-center whitespace-nowrap";
const secondaryCtaClass = "btn-primary-outline w-full sm:w-auto sm:min-w-[10rem] px-6 py-3 text-sm sm:text-base text-center whitespace-nowrap";
const backgroundSecondaryCtaClass = "inline-flex w-full sm:w-auto sm:min-w-[10rem] items-center justify-center border-2 border-white text-white px-6 py-3 rounded-button hover:bg-white hover:text-primary transition-colors font-medium text-sm sm:text-base text-center whitespace-nowrap";

type HomeSectionContext = {
  home: HomePageContent;
  featuredArtworks: ArtworkPiece[];
  recentPosts: BlogPost[];
  artworkImageFit: 'cover' | 'contain';
  showPortfolioSoldBadge: boolean;
};

const HOME_EDIT_TARGETS: Partial<Record<HomeSectionKey, string>> = {
  featured: 'home:featured',
  about: 'home:about',
  blog: 'home:blog',
  newsletter: 'home:newsletter',
};

function wrapHomeSection(sectionKey: HomeSectionKey, node: React.ReactNode) {
  if (!node) return null;
  const editTarget = HOME_EDIT_TARGETS[sectionKey];
  if (!editTarget) return node;
  return (
    <div className="relative group">
      <CmsEditAnchor targetKey={editTarget} />
      {node}
    </div>
  );
}

function renderHomeSection(key: HomeSectionKey, ctx: HomeSectionContext) {
  const { home, featuredArtworks, recentPosts, artworkImageFit, showPortfolioSoldBadge } = ctx;
  const featuredFitClass = artworkImageFit === 'contain' ? 'object-contain' : 'object-cover';

  switch (key) {
    case 'featured':
      if (!home.featured.showSection || featuredArtworks.length === 0) return null;
      return (
        <section key="featured" className="section-space-tight bg-surface">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-10 md:mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">{home.featured.title}</h2>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">{home.featured.description}</p>
            </div>

            <div className={`${gridColumnsClass(home.featured.columns)} mb-10`}>
              {featuredArtworks.map((artwork) => {
                const artworkHref = `/portfolio/${artwork.slug}`;
                return (
                  <article key={artwork.slug} className="group">
                    <ImageCarousel
                      images={artworkGalleryImages(artwork.images)}
                      alt={artwork.title}
                      href={artworkHref}
                      variantSize="md"
                      className="relative mb-3 aspect-square overflow-hidden bg-gray-100"
                      imageClassName={`${featuredFitClass} transition-transform duration-300 group-hover:scale-105 motion-reduce:transform-none`}
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    >
                      {showPortfolioSoldBadge && !artwork.available && (
                        <span className="pointer-events-none absolute right-3 top-3 z-20 bg-white/95 px-2 py-1 text-xs font-medium text-gray-900">
                          Not available
                        </span>
                      )}
                    </ImageCarousel>
                    <Link href={artworkHref} className="block">
                      <h3 className="text-xl font-semibold text-gray-900 transition-colors group-hover:text-gray-700">
                        {artwork.title}
                      </h3>
                      <p className="mt-1 text-sm text-gray-600">
                        {[artwork.medium, artwork.year].filter(Boolean).join(' · ')}
                      </p>
                      {home.featured.showDescriptions && (
                        <p className="mt-2 text-gray-700 line-clamp-2">{artwork.description}</p>
                      )}
                    </Link>
                  </article>
                );
              })}
            </div>

            <div className="text-center">
              <Link href="/portfolio" className="inline-flex items-center text-primary hover:opacity-80 font-medium text-lg">
                {home.featured.cta}
              </Link>
            </div>
          </div>
        </section>
      );

    case 'about': {
      if (!home.about.showSection) return null;
      const aboutParagraphs = [home.about.paragraph1, home.about.paragraph2]
        .flatMap((block) => splitPlainParagraphs(block));
      const hasStudioImage = Boolean(home.about.studioImage);
      return (
        <section key="about" className="section-space-tight bg-surface-muted">
          <div className={`${hasStudioImage ? 'max-w-6xl' : 'max-w-2xl text-center'} mx-auto px-6`}>
            <div className={hasStudioImage ? 'grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center' : ''}>
              <div>
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-6">{home.about.title}</h2>
                {aboutParagraphs.length > 0 && (
                  <div className="space-y-4 mb-8 text-base text-gray-700 leading-relaxed">
                    {aboutParagraphs.map((paragraph, index) => (
                      <p key={index} className="whitespace-pre-line">{paragraph}</p>
                    ))}
                  </div>
                )}
                {home.about.cta.trim() && (
                  <Link href="/contact" className="btn-primary px-6 py-3 inline-block">
                    {home.about.cta}
                  </Link>
                )}
              </div>
              {home.about.studioImage && (
                <div className="relative aspect-square rounded-lg overflow-hidden bg-gray-200">
                  <OptimizedImage
                    src={home.about.studioImage}
                    alt="Artist studio"
                    variantSize="md"
                    fill
                    className="object-cover"
                    sizes="(max-width: 1024px) 100vw, 50vw"
                  />
                </div>
              )}
            </div>
          </div>
        </section>
      );
    }

    case 'blog':
      if (!home.blog.showSection || recentPosts.length === 0) return null;
      return (
        <section key="blog" className="section-space-tight bg-surface">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-10 md:mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">{home.blog.title}</h2>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">{home.blog.description}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-10">
              {recentPosts.map((post) => {
                const postImages = post.media
                  .filter((item) => item.type === 'image')
                  .map((item) => item.url);
                const rawGallery = [post.coverImage, ...postImages].filter(
                  (src): src is string => Boolean(src && src.trim()),
                );
                const gallery = rawGallery.length > 0 ? collectImageGallery(rawGallery) : [];
                const firstVideo = !post.coverImage && post.media[0]?.type === 'video' ? post.media[0] : null;
                const postHref = updatesPostPath(post.slug);

                return (
                  <article key={post.slug} className="group bg-surface-muted rounded-lg overflow-hidden h-full hover:shadow-lg transition-shadow card-surface flex flex-col">
                    {firstVideo ? (
                      <Link href={postHref} className="block aspect-[4/3] overflow-hidden bg-gray-200">
                        <video src={firstVideo.url} className="h-full w-full object-cover" muted playsInline preload="metadata" />
                      </Link>
                    ) : gallery.length > 0 ? (
                      <ImageCarousel
                        images={gallery}
                        alt={post.title}
                        href={postHref}
                        variantSize="md"
                        className="relative aspect-[4/3] overflow-hidden bg-gray-200"
                        imageClassName="object-cover"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      />
                    ) : null}
                    <Link href={postHref} className="p-6 block flex-1">
                      <time className="text-sm text-gray-500">
                        {new Date(post.publishedAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </time>
                      <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4 group-hover:text-gray-700 transition-colors">
                        {post.format === 'short' ? (post.excerpt || post.title) : post.title}
                      </h3>
                      {post.format !== 'short' && <p className="text-gray-700 leading-relaxed">{post.excerpt}</p>}
                    </Link>
                  </article>
                );
              })}
            </div>

            <div className="text-center">
              <Link href={UPDATES_PATH} className="inline-flex items-center text-primary hover:opacity-80 font-medium text-lg">
                {home.blog.cta}
              </Link>
            </div>
          </div>
        </section>
      );

    case 'newsletter':
      if (!home.newsletter.showSection) return null;
      return (
        <section key="newsletter" className="section-space-tight bg-surface border-t border-gray-200">
          <div className="max-w-4xl mx-auto px-6 text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">{home.newsletter.title}</h2>
            <p className="text-lg md:text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
              {home.newsletter.description}
            </p>
            <NewsletterSignup
              variant="onLight"
              placeholder={home.newsletter.placeholder}
              buttonLabel={home.newsletter.buttonLabel}
              disclaimer={home.newsletter.disclaimer}
            />
          </div>
        </section>
      );

    default:
      return null;
  }
}

export default async function Home() {
  const [home, portfolio, siteShell, siteUrl] = await Promise.all([
    getSiteContent('home'),
    getSiteContent('portfolio'),
    getPublicSiteShell(),
    getSiteUrl(),
  ]);
  const [recentPosts, featuredArtworks] = await Promise.all([
    getAllPosts().then((posts) => posts.slice(0, 3)),
    resolveFeaturedArtworks(home.featured),
  ]);
  const webSiteSchema = generateWebSiteSchema({
    name: siteShell.identity.siteName,
    alternateNames: deriveSiteAlternateNames(siteUrl, siteShell.socialUrls),
    description: buildHomeMetaDescription(siteShell.identity.tagline, home.hero.subtitle, home.about.paragraph1),
    siteUrl,
  });

  const ctas = homeHeroCtas(home);
  const portraitImage = home.hero.portraitImage;
  const isBackgroundHero = home.hero.imagePlacement === 'background' && Boolean(portraitImage);
  const isInlineHero = home.hero.imagePlacement === 'inline' && Boolean(portraitImage);
  const isBadgeHero = home.hero.imagePlacement === 'badge' && Boolean(portraitImage);
  const heroHeightClass = homeHeroHeightClass(home.hero.height, { isBackground: isBackgroundHero });
  const heroTextClass = isBackgroundHero ? 'text-white' : 'text-gray-900';
  const heroSubtitleClass = isBackgroundHero ? 'text-gray-100' : 'text-gray-700';
  const heroAccentClass = isBackgroundHero ? 'text-gray-200' : 'text-accent';
  const { beforeHero, afterHero } = resolveHomeSectionRenderPlan(home);
  const sectionContext: HomeSectionContext = {
    home,
    featuredArtworks,
    recentPosts,
    artworkImageFit: portfolio.layout.imageFit,
    showPortfolioSoldBadge: portfolio.layout.showSoldBadge,
  };

  return (
    <div className="min-h-screen">
      <StructuredData data={webSiteSchema} />
      {beforeHero.map((sectionKey) => (
        <React.Fragment key={sectionKey}>
          {wrapHomeSection(sectionKey, renderHomeSection(sectionKey, sectionContext))}
        </React.Fragment>
      ))}

      <section className={`relative group flex items-center justify-center overflow-hidden ${isBackgroundHero ? 'bg-primary' : 'bg-gradient-to-br from-surface-muted to-surface-sunken'} ${heroHeightClass}`}>
        <CmsEditAnchor targetKey="home:hero" />
        {isBackgroundHero && portraitImage && (
          <>
            <OptimizedImage src={portraitImage} alt="" variantSize="lg" fill className={`object-cover ${homeHeroImagePositionClass(home.hero.imageFocus)}`} sizes="100vw" priority />
            <div className="absolute inset-0 bg-black/50" />
          </>
        )}
        <div className={`relative z-10 max-w-5xl mx-auto px-6 ${isInlineHero ? 'grid grid-cols-1 md:grid-cols-2 gap-10 items-center' : 'text-center'}`}>
          {isInlineHero && portraitImage && (
            <div className="relative mx-auto w-40 h-40 md:w-full md:h-auto md:aspect-[4/5] rounded-full md:rounded-lg overflow-hidden shadow-xl">
              <OptimizedImage
                src={portraitImage}
                alt="Artist portrait"
                variantSize="lg"
                fill
                className="object-cover"
                sizes="(max-width: 768px) 160px, 50vw"
                priority
              />
            </div>
          )}
          <div>
            <h1 className={`text-4xl md:text-7xl font-bold mb-6 ${heroTextClass}`}>
              {home.hero.titleLine1}<br />
              <span className={heroAccentClass}>{home.hero.titleLine2}</span>
            </h1>
            <p className={`text-lg md:text-2xl mb-8 max-w-2xl ${isInlineHero ? '' : 'mx-auto'} ${heroSubtitleClass}`}>
              {home.hero.subtitle}
            </p>
            <div className={heroCtaLayoutClass(isInlineHero)}>
              {ctas.map((cta) => (
                <Link
                  key={cta.key}
                  href={cta.href}
                  className={cta.variant === 'primary'
                    ? primaryCtaClass
                    : (isBackgroundHero ? backgroundSecondaryCtaClass : secondaryCtaClass)}
                >
                  {cta.label}
                </Link>
              ))}
            </div>
            {isBadgeHero && portraitImage && (
              <div className="relative mt-8 mx-auto w-24 h-24 rounded-full overflow-hidden border-4 border-white shadow-xl">
                <OptimizedImage src={portraitImage} alt="Artist portrait" variantSize="thumb" fill className="object-cover" sizes="96px" priority />
              </div>
            )}
          </div>
        </div>
      </section>

      {afterHero.map((sectionKey) => (
        <React.Fragment key={sectionKey}>
          {wrapHomeSection(sectionKey, renderHomeSection(sectionKey, sectionContext))}
        </React.Fragment>
      ))}
    </div>
  );
}
