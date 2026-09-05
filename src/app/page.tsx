import Image from "next/image";
import Link from "next/link";
import { getAllPosts } from "@/lib/markdown";
import { resolveFeaturedArtworks } from "@/lib/portfolio";
import { getSiteContent } from "@/lib/site-content";
import {
  homeHeroCtas,
  homeHeroHeightClass,
  normalizeHomeSectionOrder,
  type HomePageContent,
  type HomeSectionKey,
} from "@/lib/site-content-shared";
import type { ArtworkPiece } from "@/lib/portfolio";
import type { BlogPost } from "@/lib/markdown";
import { NewsletterSignup } from "@/components/NewsletterSignup";

export const dynamic = 'force-dynamic';

const primaryCtaClass = "btn-primary px-8 py-3 md:py-4 rounded-lg text-base md:text-lg text-center";
const secondaryCtaClass = "btn-primary-outline px-8 py-3 md:py-4 rounded-lg text-base md:text-lg text-center";

type HomeSectionContext = {
  home: HomePageContent;
  featuredArtworks: ArtworkPiece[];
  recentPosts: BlogPost[];
};

function renderHomeSection(key: HomeSectionKey, ctx: HomeSectionContext) {
  const { home, featuredArtworks, recentPosts } = ctx;

  switch (key) {
    case 'featured':
      if (!home.featured.showSection) return null;
      return (
        <section key="featured" className="section-space-tight bg-white">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-10 md:mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">{home.featured.title}</h2>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">{home.featured.description}</p>
            </div>

            {featuredArtworks.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-10">
                {featuredArtworks.map((artwork) => (
                  <Link key={artwork.slug} href={`/portfolio/${artwork.slug}`} className="group">
                    <div className="relative aspect-square overflow-hidden rounded-lg bg-gray-100 mb-4">
                      <Image
                        src={artwork.images.thumbnail}
                        alt={artwork.title}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2 group-hover:text-gray-700 transition-colors">
                      {artwork.title}
                    </h3>
                    <p className="text-gray-600 text-sm mb-2">{artwork.medium}</p>
                    {home.featured.showDescriptions && (
                      <p className="text-gray-700">{artwork.description}</p>
                    )}
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-500">{home.featured.emptyMessage}</p>
              </div>
            )}

            <div className="text-center">
              <Link href="/portfolio" className="inline-flex items-center text-primary hover:opacity-80 font-medium text-lg">
                {home.featured.cta}
              </Link>
            </div>
          </div>
        </section>
      );

    case 'about':
      if (!home.about.showSection) return null;
      return (
        <section key="about" className="section-space-tight bg-gray-50">
          <div className="max-w-6xl mx-auto px-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
              <div>
                <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">{home.about.title}</h2>
                <p className="text-lg text-gray-700 mb-6 leading-relaxed">{home.about.paragraph1}</p>
                <p className="text-lg text-gray-700 mb-8 leading-relaxed">{home.about.paragraph2}</p>
                <Link href="/contact" className="btn-primary px-6 py-3 rounded-lg inline-block">
                  {home.about.cta}
                </Link>
              </div>
              {home.about.studioImage && (
                <div className="relative aspect-square rounded-lg overflow-hidden bg-gray-200">
                  <Image
                    src={home.about.studioImage}
                    alt="Artist studio"
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

    case 'blog':
      if (!home.blog.showSection) return null;
      return (
        <section key="blog" className="section-space-tight bg-white">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-10 md:mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">{home.blog.title}</h2>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">{home.blog.description}</p>
            </div>

            {recentPosts.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-10">
                {recentPosts.map((post) => (
                  <Link key={post.slug} href={`/blog/${post.slug}`} className="group">
                    <article className="bg-gray-50 rounded-lg p-6 h-full hover:shadow-lg transition-shadow">
                      <time className="text-sm text-gray-500">
                        {new Date(post.publishedAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </time>
                      <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4 group-hover:text-gray-700 transition-colors">
                        {post.title}
                      </h3>
                      <p className="text-gray-700 leading-relaxed">{post.excerpt}</p>
                    </article>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-500">{home.blog.emptyMessage}</p>
              </div>
            )}

            <div className="text-center">
              <Link href="/blog" className="inline-flex items-center text-primary hover:opacity-80 font-medium text-lg">
                {home.blog.cta}
              </Link>
            </div>
          </div>
        </section>
      );

    case 'newsletter':
      if (!home.newsletter.showSection) return null;
      return (
        <section key="newsletter" className="section-space-tight bg-primary text-white">
          <div className="max-w-4xl mx-auto px-6 text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">{home.newsletter.title}</h2>
            <p className="text-lg md:text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
              {home.newsletter.description}
            </p>
            <NewsletterSignup
              variant="onDark"
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
  const home = await getSiteContent('home');
  const [recentPosts, featuredArtworks] = await Promise.all([
    getAllPosts().then((posts) => posts.slice(0, 3)),
    resolveFeaturedArtworks(home.featured),
  ]);

  const ctas = homeHeroCtas(home);
  const portraitImage = home.hero.portraitImage;
  const isBackgroundHero = home.hero.imagePlacement === 'background' && Boolean(portraitImage);
  const isInlineHero = home.hero.imagePlacement === 'inline' && Boolean(portraitImage);
  const isBadgeHero = home.hero.imagePlacement === 'badge' && Boolean(portraitImage);
  const heroHeightClass = homeHeroHeightClass(home.hero.height);
  const heroTextClass = isBackgroundHero ? 'text-white' : 'text-gray-900';
  const heroSubtitleClass = isBackgroundHero ? 'text-gray-100' : 'text-gray-700';
  const heroAccentClass = isBackgroundHero ? 'text-gray-200' : 'text-gray-600';
  const sectionOrder = normalizeHomeSectionOrder(home.sectionOrder);
  const sectionContext: HomeSectionContext = { home, featuredArtworks, recentPosts };

  return (
    <div className="min-h-screen">
      <section className={`relative flex items-center justify-center overflow-hidden ${isBackgroundHero ? 'bg-primary' : 'bg-gradient-to-br from-gray-50 to-gray-100'} ${heroHeightClass}`}>
        {isBackgroundHero && portraitImage && (
          <>
            <Image src={portraitImage} alt="" fill className="object-cover" sizes="100vw" priority />
            <div className="absolute inset-0 bg-black/50" />
          </>
        )}
        <div className={`relative z-10 max-w-5xl mx-auto px-6 ${isInlineHero ? 'grid grid-cols-1 md:grid-cols-2 gap-10 items-center' : 'text-center'}`}>
          {isInlineHero && portraitImage && (
            <div className="relative mx-auto w-40 h-40 md:w-full md:h-auto md:aspect-[4/5] rounded-full md:rounded-lg overflow-hidden shadow-xl">
              <Image
                src={portraitImage}
                alt="Artist portrait"
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
            <div className={`flex flex-col sm:flex-row gap-3 sm:gap-4 ${isInlineHero ? '' : 'justify-center'}`}>
              {ctas.map((cta) => (
                <Link
                  key={cta.key}
                  href={cta.href}
                  className={cta.variant === 'primary'
                    ? (isBackgroundHero ? primaryCtaClass : primaryCtaClass)
                    : (isBackgroundHero
                      ? 'border-2 border-white text-white px-8 py-3 md:py-4 rounded-lg hover:bg-white hover:text-primary transition-colors font-medium text-base md:text-lg text-center'
                      : secondaryCtaClass)}
                >
                  {cta.label}
                </Link>
              ))}
            </div>
            {isBadgeHero && portraitImage && (
              <div className="relative mt-8 mx-auto w-24 h-24 rounded-full overflow-hidden border-4 border-white shadow-xl">
                <Image src={portraitImage} alt="Artist portrait" fill className="object-cover" sizes="96px" />
              </div>
            )}
          </div>
        </div>
      </section>

      {sectionOrder.map((sectionKey) => renderHomeSection(sectionKey, sectionContext))}
    </div>
  );
}
