# ADR: SEO Domain Facade Consolidation

Date: 2025-08-19
Status: Accepted

## Context
Originally, SEO JSON-LD schema builder utilities (Article, Product, Organization, VisualArtwork, Breadcrumb, FAQ, HowTo, etc.) lived under the UI layer at `@ui/components/content/seo/*`. This mixed pure content modeling logic with presentation and encouraged page/routes to deep import UI internals for non-visual concerns.

## Decision
All schema builder logic was migrated to a new domain-level module: `@domain/seo` with a barrel (`src/domain/seo/index.ts`) exporting the public API (e.g. `generateArticleSchema`). The UI layer now supplies only rendering helpers (`StructuredData` component) at `@ui/components/content/seo`.

Deprecated stub files were temporarily retained emitting console warnings to guide refactor progress. After confirming no lingering imports via grep and a clean dependency graph (no new violations), the stubs were removed.

## Rationale
- Enforces layering: SEO modeling is domain logic (pure data construction) and should not depend on UI.
- Reduces bundle surface: pages import only the minimal functions from a domain facade.
- Simplifies future enhancements (centralized validation and schema extension).
- Eliminates duplicate / fragmented SEO utilities across `ui/` and `lib/`.

## Consequences
- Any new SEO schema builders must be added in `src/domain/seo/` and exported via the index barrel.
- UI imports of former paths (e.g. `@ui/components/content/seo/product`) will now fail fast—ensuring no regression.
- StructuredData component remains the only allowed UI export for SEO concerns.

## Validation Steps Performed
1. Grep for legacy imports referencing `@ui/components/content/seo/<builder>` returned only the stub files themselves.
2. Removed stub files: `article.ts, product.ts, organization.ts, visualArtwork.ts, breadcrumb.ts, faq.ts, howTo.ts`.
3. Ran `npm run depgraph:check` – no new errors introduced (only pre-existing warnings unrelated to SEO migration).
4. Updated progress log (`memory-bank/progress.md`).

## Follow-Up / Future Work
- (Optional) Add ESLint `no-restricted-imports` guard disallowing `@ui/components/content/seo/*` except the package root to prevent reintroduction.
- Consolidate any remaining SEO utilities from `lib/` into `@domain/seo` (if discovered during broader refactor phases).
- Add testing around domain SEO builders to ensure purity and stability.

## Alternatives Considered
- Keeping builders in UI with a stricter naming convention (rejected: still violates separation of concerns).
- Moving builders to `application/seoService` (rejected: they are pure value construction, better suited to domain layer).

## References
- Refactor Roadmap Phases 7 & 2 (SEO Consolidation & Domain Façade Normalization).
