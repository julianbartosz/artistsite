import Image from 'next/image';
import Link from 'next/link';
import { getSiteContent } from '@/lib/site-content';
import { htmlHasVisibleText } from '@/lib/site-content-shared';

export const dynamic = 'force-dynamic';

export default async function BioPage() {
  const bio = await getSiteContent('bio');

  return (
    <div className="min-h-screen bg-white">
      <section className="relative bg-gray-50 section-space">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-12 items-center">
            <div>
              <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
                {bio.hero.title}
              </h1>
              {bio.hero.subtitle.trim() && (
              <p className="text-xl text-gray-600 mb-8 leading-relaxed">
                {bio.hero.subtitle}
              </p>
              )}
              <div className="flex flex-col sm:flex-row gap-4">
                {bio.hero.ctaPortfolio.trim() && (
                <Link
                  href="/portfolio"
                  className="bg-gray-900 text-white px-6 py-3 rounded-lg hover:bg-gray-800 transition-colors text-center font-medium"
                >
                  {bio.hero.ctaPortfolio}
                </Link>
                )}
                {bio.hero.ctaContact.trim() && (
                <Link
                  href="/contact"
                  className="border border-gray-900 text-gray-900 px-6 py-3 rounded-lg hover:bg-gray-900 hover:text-white transition-colors text-center font-medium"
                >
                  {bio.hero.ctaContact}
                </Link>
                )}
              </div>
            </div>
            {bio.hero.portraitImage && (
              <div className="relative">
                <div className="relative w-full max-w-xs mx-auto lg:max-w-none aspect-[3/4] lg:aspect-[4/5] rounded-lg overflow-hidden shadow-xl">
                  <Image
                    src={bio.hero.portraitImage}
                    alt="Artist in studio"
                    fill
                    className="object-cover"
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    priority
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {bio.showStatement && htmlHasVisibleText(bio.artistStatementHtml) && (
      <section className="section-space-tight">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">{bio.statementTitle}</h2>
          <div className="prose prose-lg mx-auto text-gray-700" dangerouslySetInnerHTML={{ __html: bio.artistStatementHtml }} />
        </div>
      </section>
      )}

      {(bio.showBackground || bio.showAchievements) && (htmlHasVisibleText(bio.backgroundHtml) || htmlHasVisibleText(bio.achievementsHtml)) && (
      <section className="bg-gray-50 section-space-tight">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-12">
            {bio.showBackground && htmlHasVisibleText(bio.backgroundHtml) && (
            <>
            <details className="lg:hidden group">
              <summary className="cursor-pointer text-2xl font-bold text-gray-900 mb-4">{bio.backgroundTitle}</summary>
              <div className="prose prose-lg text-gray-700" dangerouslySetInnerHTML={{ __html: bio.backgroundHtml }} />
            </details>
            <div className="hidden lg:block">
              <h2 className="text-3xl font-bold text-gray-900 mb-8">{bio.backgroundTitle}</h2>
              <div className="prose prose-lg text-gray-700" dangerouslySetInnerHTML={{ __html: bio.backgroundHtml }} />
            </div>
            </>
            )}
            {bio.showAchievements && htmlHasVisibleText(bio.achievementsHtml) && (
            <>
            <details className="lg:hidden">
              <summary className="cursor-pointer text-2xl font-bold text-gray-900 mb-4">{bio.achievementsTitle}</summary>
              <div className="prose prose-lg text-gray-700" dangerouslySetInnerHTML={{ __html: bio.achievementsHtml }} />
            </details>
            <div className="hidden lg:block">
              <h2 className="text-3xl font-bold text-gray-900 mb-8">{bio.achievementsTitle}</h2>
              <div className="prose prose-lg text-gray-700" dangerouslySetInnerHTML={{ __html: bio.achievementsHtml }} />
            </div>
            </>
            )}
          </div>
        </div>
      </section>
      )}

      {bio.showStudio && (htmlHasVisibleText(bio.studioPracticeHtml) || Boolean(bio.studioImage)) && (
      <section className="section-space-tight">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">{bio.studioTitle}</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-12 items-center">
            {bio.studioImage && (
              <div className="relative w-full aspect-[4/3] rounded-lg overflow-hidden shadow-lg">
                <Image
                  src={bio.studioImage}
                  alt="Artist studio workspace"
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                />
              </div>
            )}
            {htmlHasVisibleText(bio.studioPracticeHtml) && (
              <div className="prose prose-lg text-gray-700" dangerouslySetInnerHTML={{ __html: bio.studioPracticeHtml }} />
            )}
          </div>
        </div>
      </section>
      )}

      {bio.showCollections && htmlHasVisibleText(bio.collectionsHtml) && (
      <section className="bg-gray-50 section-space-tight">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-8">{bio.collectionsTitle}</h2>
          <div className="prose prose-lg mx-auto text-gray-700 text-left" dangerouslySetInnerHTML={{ __html: bio.collectionsHtml }} />
        </div>
      </section>
      )}

      {bio.showCta && (
      <section className="section-space-tight">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">{bio.cta.title}</h2>
          {bio.cta.subtitle.trim() && (
          <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
            {bio.cta.subtitle}
          </p>
          )}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {bio.cta.portfolioLabel.trim() && (
            <Link
              href="/portfolio"
              className="bg-gray-900 text-white px-8 py-3 rounded-lg hover:bg-gray-800 transition-colors font-medium"
            >
              {bio.cta.portfolioLabel}
            </Link>
            )}
            {bio.cta.shopLabel.trim() && (
            <Link
              href="/shop"
              className="border border-gray-900 text-gray-900 px-8 py-3 rounded-lg hover:bg-gray-900 hover:text-white transition-colors font-medium"
            >
              {bio.cta.shopLabel}
            </Link>
            )}
            {bio.cta.contactLabel.trim() && (
            <Link
              href="/contact"
              className="border border-gray-300 text-gray-700 px-8 py-3 rounded-lg hover:border-gray-900 hover:text-gray-900 transition-colors font-medium"
            >
              {bio.cta.contactLabel}
            </Link>
            )}
          </div>
        </div>
      </section>
      )}
    </div>
  );
}
