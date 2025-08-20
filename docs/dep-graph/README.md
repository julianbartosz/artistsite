# Dependency Graph Artifacts

Generated: 2025-08-15
Tool: dependency-cruiser
Command: `npm run depgraph:all`

## Summary
- Modules cruised: 338
- Dependencies: 484
- Forbidden violations: 0
- Circulars (warn level): 0 (none reported)
- Orphans: 0 (manual review of dependency-graph.json; no modules without inbound references excluding entrypoints and barrels)

## Hardening Verification
Removed:
- `src/lib/commerce.ts`
- `src/lib/empty-stub.ts`

All legacy imports rewritten by `scripts/codemod-rewrite-imports.js` (`npm run codemod:imports -- --check` passes).

## Regeneration Instructions
1. Run full graph generation:
   ```bash
   npm run depgraph:all
   ```
2. Validate no violations:
   ```bash
   npm run depgraph:check
   ```
3. (Optional) Open `docs/dep-graph/dependency-graph.json` to inspect.

## Maintenance Guidelines
- Re-run after structural refactors (new domains, removed shims).
- Keep this README updated with counts & date.
- Document any intentional orphans (none currently).

## Intentional Entry Points (Not Counted as Orphans)
- `src/app/*` route handlers & pages
- Domain barrel files under `src/domain/*/index.ts`
- UI component barrels in `src/ui/components/*`

## Guardrails Reference
See `.dependency-cruiser.cjs` for enforced rules (client→server boundary, circular warnings).
