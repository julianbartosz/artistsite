import Image from 'next/image';
import Link from 'next/link';
import { getSiteContent } from '@/lib/site-content';
import {
  htmlHasVisibleText,
  normalizeBioSectionOrder,
  type BioPageContent,
  type BioSectionKey,
} from '@/lib/site-content-shared';
import CmsEditAnchor from '@/components/admin/CmsEditAnchor';

export const dynamic = 'force-dynamic';

function BioHero({ bio }: { bio: BioPageContent }) {
  return (
    <section className="relative group bg-gray-50 section-space">
      <CmsEditAnchor targetKey="bio:hero" />
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
  );
}

function BioStatement({ bio }: { bio: BioPageContent }) {
  if (!bio.showStatement || !htmlHasVisibleText(bio.artistStatementHtml)) return null;
  return (
    <section className="relative group section-space-tight">
      <CmsEditAnchor targetKey="bio:statement" />
      <div className="max-w-4xl mx-auto px-6">
        <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">{bio.statementTitle}</h2>
        <div className="prose prose-lg mx-auto text-gray-700" dangerouslySetInnerHTML={{ __html: bio.artistStatementHtml }} />
      </div>
    </section>
  );
}

function BioBackgroundAchievements({ bio }: { bio: BioPageContent }) {
  const showBackground = bio.showBackground && htmlHasVisibleText(bio.backgroundHtml);
  const showAchievements = bio.showAchievements && htmlHasVisibleText(bio.achievementsHtml);
  if (!showBackground && !showAchievements) return null;

  return (
    <section className="bg-gray-50 section-space-tight">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-12">
          {showBackground && (
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
          {showAchievements && (
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
  );
}

function BioBackground({ bio }: { bio: BioPageContent }) {
  if (!bio.showBackground || !htmlHasVisibleText(bio.backgroundHtml)) return null;
  return (
    <section className="relative group bg-gray-50 section-space-tight">
      <CmsEditAnchor targetKey="bio:background" />
      <div className="max-w-4xl mx-auto px-6">
        <h2 className="text-3xl font-bold text-gray-900 mb-8">{bio.backgroundTitle}</h2>
        <div className="prose prose-lg text-gray-700" dangerouslySetInnerHTML={{ __html: bio.backgroundHtml }} />
      </div>
    </section>
  );
}

function BioAchievements({ bio }: { bio: BioPageContent }) {
  if (!bio.showAchievements || !htmlHasVisibleText(bio.achievementsHtml)) return null;
  return (
    <section className="bg-gray-50 section-space-tight">
      <div className="max-w-4xl mx-auto px-6">
        <h2 className="text-3xl font-bold text-gray-900 mb-8">{bio.achievementsTitle}</h2>
        <div className="prose prose-lg text-gray-700" dangerouslySetInnerHTML={{ __html: bio.achievementsHtml }} />
      </div>
    </section>
  );
}

function BioStudio({ bio }: { bio: BioPageContent }) {
  if (!bio.showStudio || (!htmlHasVisibleText(bio.studioPracticeHtml) && !bio.studioImage)) return null;
  return (
    <section className="relative group section-space-tight">
      <CmsEditAnchor targetKey="bio:studio" />
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
  );
}

function BioCollections({ bio }: { bio: BioPageContent }) {
  if (!bio.showCollections || !htmlHasVisibleText(bio.collectionsHtml)) return null;
  return (
    <section className="relative group bg-gray-50 section-space-tight">
      <CmsEditAnchor targetKey="bio:collections" />
      <div className="max-w-4xl mx-auto px-6 text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-8">{bio.collectionsTitle}</h2>
        <div className="prose prose-lg mx-auto text-gray-700 text-left" dangerouslySetInnerHTML={{ __html: bio.collectionsHtml }} />
      </div>
    </section>
  );
}

function BioCta({ bio }: { bio: BioPageContent }) {
  if (!bio.showCta) return null;
  return (
    <section className="relative group section-space-tight">
      <CmsEditAnchor targetKey="bio:cta" />
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
  );
}

function renderBioSection(key: BioSectionKey, bio: BioPageContent) {
  switch (key) {
    case 'statement':
      return <BioStatement key="statement" bio={bio} />;
    case 'background':
      return <BioBackground key="background" bio={bio} />;
    case 'achievements':
      return <BioAchievements key="achievements" bio={bio} />;
    case 'studio':
      return <BioStudio key="studio" bio={bio} />;
    case 'collections':
      return <BioCollections key="collections" bio={bio} />;
    case 'cta':
      return <BioCta key="cta" bio={bio} />;
    default:
      return null;
  }
}

function isBackgroundAchievementsPair(order: BioSectionKey[], index: number): boolean {
  const current = order[index];
  const next = order[index + 1];
  return (
    (current === 'background' && next === 'achievements') ||
    (current === 'achievements' && next === 'background')
  );
}

export default async function BioPage() {
  const bio = await getSiteContent('bio');
  const order = normalizeBioSectionOrder(bio.sectionOrder);
  const sections: React.ReactNode[] = [];

  for (let index = 0; index < order.length; index += 1) {
    const key = order[index];
    if (isBackgroundAchievementsPair(order, index)) {
      sections.push(<BioBackgroundAchievements key={`pair-${index}`} bio={bio} />);
      index += 1;
      continue;
    }
    sections.push(renderBioSection(key, bio));
  }

  return (
    <div className="min-h-screen bg-white">
      <BioHero bio={bio} />
      {sections}
    </div>
  );
}
