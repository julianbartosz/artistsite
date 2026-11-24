import Link from 'next/link';
import { getSiteContent } from '@/lib/site-content';
import {
  htmlHasVisibleText,
  normalizeBioSectionOrder,
  splitPlainParagraphs,
  type BioPageContent,
  type BioSectionKey,
} from '@/lib/site-content-shared';
import CmsEditAnchor from '@/components/admin/CmsEditAnchor';
import OptimizedImage from '@/components/OptimizedImage';

export const dynamic = 'force-dynamic';

function BioHero({ bio }: { bio: BioPageContent }) {
  const hasPortrait = Boolean(bio.hero.portraitImage);
  const introParagraphs = splitPlainParagraphs(bio.hero.subtitle);
  const hasCtas = Boolean(bio.hero.ctaPortfolio.trim() || bio.hero.ctaContact.trim());
  return (
    <section className="relative group bg-surface-muted section-space-tight">
      <CmsEditAnchor targetKey="bio:hero" />
      <div className={`${hasPortrait ? 'max-w-6xl' : 'max-w-2xl text-center'} mx-auto px-6`}>
        <div className={hasPortrait ? 'grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-12 items-center' : ''}>
          <div>
            <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-6">
              {bio.hero.title}
            </h1>
            {introParagraphs.length > 0 && (
              <div className="space-y-4 text-base text-gray-600 mb-8 leading-relaxed">
                {introParagraphs.map((paragraph, index) => (
                  <p key={index} className="whitespace-pre-line">{paragraph}</p>
                ))}
              </div>
            )}
            {hasCtas && (
              <div className={`flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-4 ${hasPortrait ? '' : 'justify-center'}`}>
                {bio.hero.ctaPortfolio.trim() && (
                  <Link
                    href="/portfolio"
                    className="btn-primary w-full sm:w-auto px-6 py-3 transition-colors font-medium whitespace-nowrap"
                  >
                    {bio.hero.ctaPortfolio}
                  </Link>
                )}
                {bio.hero.ctaContact.trim() && (
                  <Link
                    href="/contact"
                    className="btn-primary-outline w-full sm:w-auto px-6 py-3 transition-colors font-medium whitespace-nowrap"
                  >
                    {bio.hero.ctaContact}
                  </Link>
                )}
              </div>
            )}
          </div>
          {bio.hero.portraitImage && (
            <div className="relative">
              <div className="relative w-full max-w-xs mx-auto lg:max-w-none aspect-[3/4] lg:aspect-[4/5] rounded-lg overflow-hidden shadow-xl">
                <OptimizedImage
                  src={bio.hero.portraitImage}
                  alt={bio.hero.portraitImageAlt.trim() || 'Artist portrait'}
                  variantSize="lg"
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
      <div className="max-w-2xl mx-auto px-6">
        {bio.statementTitle.trim() && (
          <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-6 text-center">{bio.statementTitle}</h2>
        )}
        <div className="prose prose-base mx-auto text-gray-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: bio.artistStatementHtml }} />
      </div>
    </section>
  );
}

function BioBackgroundAchievements({ bio }: { bio: BioPageContent }) {
  const showBackground = bio.showBackground && htmlHasVisibleText(bio.backgroundHtml);
  const showAchievements = bio.showAchievements && htmlHasVisibleText(bio.achievementsHtml);
  if (!showBackground && !showAchievements) return null;

  return (
    <section className="relative group bg-surface-muted section-space-tight">
      <CmsEditAnchor targetKey="bio:background" />
      <div className={`${showBackground && showAchievements ? 'max-w-5xl' : 'max-w-2xl'} mx-auto px-6`}>
        <div className={`grid grid-cols-1 ${showBackground && showAchievements ? 'lg:grid-cols-2' : ''} gap-10 lg:gap-12`}>
          {showBackground && (
            <div>
              <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-5">{bio.backgroundTitle}</h2>
              <div className="prose prose-base text-gray-700" dangerouslySetInnerHTML={{ __html: bio.backgroundHtml }} />
            </div>
          )}
          {showAchievements && (
            <div>
              <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-5">{bio.achievementsTitle}</h2>
              <div className="prose prose-base text-gray-700" dangerouslySetInnerHTML={{ __html: bio.achievementsHtml }} />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function BioBackground({ bio }: { bio: BioPageContent }) {
  if (!bio.showBackground || !htmlHasVisibleText(bio.backgroundHtml)) return null;
  return (
    <section className="relative group bg-surface-muted section-space-tight">
      <CmsEditAnchor targetKey="bio:background" />
      <div className="max-w-2xl mx-auto px-6">
        <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-6 text-center">{bio.backgroundTitle}</h2>
        <div className="prose prose-base mx-auto text-gray-700" dangerouslySetInnerHTML={{ __html: bio.backgroundHtml }} />
      </div>
    </section>
  );
}

function BioAchievements({ bio }: { bio: BioPageContent }) {
  if (!bio.showAchievements || !htmlHasVisibleText(bio.achievementsHtml)) return null;
  return (
    <section className="bg-surface-muted section-space-tight">
      <div className="max-w-2xl mx-auto px-6">
        <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-6 text-center">{bio.achievementsTitle}</h2>
        <div className="prose prose-base mx-auto text-gray-700" dangerouslySetInnerHTML={{ __html: bio.achievementsHtml }} />
      </div>
    </section>
  );
}

function BioStudio({ bio }: { bio: BioPageContent }) {
  if (!bio.showStudio || (!htmlHasVisibleText(bio.studioPracticeHtml) && !bio.studioImage)) return null;
  const hasStudioImage = Boolean(bio.studioImage);
  return (
    <section className="relative group section-space-tight">
      <CmsEditAnchor targetKey="bio:studio" />
      <div className={`${hasStudioImage ? 'max-w-5xl' : 'max-w-2xl'} mx-auto px-6`}>
        <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-6 text-center">{bio.studioTitle}</h2>
        <div className={hasStudioImage ? 'grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-12 items-center' : ''}>
          {bio.studioImage && (
            <div className="relative w-full aspect-[4/3] rounded-lg overflow-hidden shadow-lg">
              <OptimizedImage
                src={bio.studioImage}
                alt={bio.studioImageAlt.trim() || 'Studio workspace'}
                variantSize="md"
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
            </div>
          )}
          {htmlHasVisibleText(bio.studioPracticeHtml) && (
            <div className="prose prose-base mx-auto text-gray-700" dangerouslySetInnerHTML={{ __html: bio.studioPracticeHtml }} />
          )}
        </div>
      </div>
    </section>
  );
}

function BioCollections({ bio }: { bio: BioPageContent }) {
  if (!bio.showCollections || !htmlHasVisibleText(bio.collectionsHtml)) return null;
  return (
    <section className="relative group bg-surface-muted section-space-tight">
      <CmsEditAnchor targetKey="bio:collections" />
      <div className="max-w-2xl mx-auto px-6">
        <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-6 text-center">{bio.collectionsTitle}</h2>
        <div className="prose prose-base mx-auto text-gray-700" dangerouslySetInnerHTML={{ __html: bio.collectionsHtml }} />
      </div>
    </section>
  );
}

function BioCta({ bio }: { bio: BioPageContent }) {
  if (!bio.showCta) return null;
  return (
    <section className="relative group section-space-tight">
      <CmsEditAnchor targetKey="bio:cta" />
      <div className="max-w-2xl mx-auto px-6 text-center">
        <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-4">{bio.cta.title}</h2>
        {bio.cta.subtitle.trim() && (
          <p className="text-base text-gray-600 mb-8 max-w-xl mx-auto leading-relaxed">
            {bio.cta.subtitle}
          </p>
        )}
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-4 justify-center">
          {bio.cta.portfolioLabel.trim() && (
            <Link
              href="/portfolio"
              className="btn-primary w-full sm:w-auto px-8 py-3 transition-colors font-medium whitespace-nowrap"
            >
              {bio.cta.portfolioLabel}
            </Link>
          )}
          {bio.cta.shopLabel.trim() && (
            <Link
              href="/shop"
              className="btn-primary-outline w-full sm:w-auto px-8 py-3 transition-colors font-medium whitespace-nowrap"
            >
              {bio.cta.shopLabel}
            </Link>
          )}
          {bio.cta.contactLabel.trim() && (
            <Link
              href="/contact"
              className="inline-flex w-full sm:w-auto items-center justify-center rounded-button border border-gray-300 px-8 py-3 font-medium text-gray-700 transition-colors hover:border-gray-900 hover:text-gray-900 whitespace-nowrap"
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
  const hasBodyContent =
    (bio.showStatement && htmlHasVisibleText(bio.artistStatementHtml)) ||
    (bio.showBackground && htmlHasVisibleText(bio.backgroundHtml)) ||
    (bio.showAchievements && htmlHasVisibleText(bio.achievementsHtml)) ||
    (bio.showStudio && (htmlHasVisibleText(bio.studioPracticeHtml) || Boolean(bio.studioImage))) ||
    (bio.showCollections && htmlHasVisibleText(bio.collectionsHtml));
  const sections: React.ReactNode[] = [];

  for (let index = 0; index < order.length; index += 1) {
    const key = order[index];
    // Avoid stacking a second CTA right beneath the hero before any bio body sections exist.
    if (key === 'cta' && !hasBodyContent) continue;
    if (isBackgroundAchievementsPair(order, index)) {
      sections.push(<BioBackgroundAchievements key={`pair-${index}`} bio={bio} />);
      index += 1;
      continue;
    }
    sections.push(renderBioSection(key, bio));
  }

  return (
    <div className="bg-surface">
      <BioHero bio={bio} />
      {sections}
    </div>
  );
}
