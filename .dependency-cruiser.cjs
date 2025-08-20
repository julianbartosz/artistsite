/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  options: {
    tsConfig: { fileName: 'tsconfig.json' },
    /* focus on src only */
    includeOnly: '^src',
    doNotFollow: {
      path: 'node_modules|coverage|dist|build|public',
      dependencyTypes: [
        'npm',
        'npm-dev',
        'npm-peer',
        'npm-optional'
      ]
    },
    /* Useful to keep the graphs smaller */
    exclude: ['^node_modules', '^coverage', '^dist', '^build', '^public']
    // reporterOptions removed pending correct theme schema
  },
  forbidden: [
    /* prevent server-only code from leaking into client (app/ui) */
    {
      name: 'no-client-to-server',
      comment: 'UI or app code must not import from server-only modules',
      severity: 'error',
      from: {
        path: 'src/(?:app|ui)/'
      },
      to: {
        path: 'src/server/|^@server/'
      }
    },
    /* catch circular dependencies */
    {
      name: 'no-circular',
      severity: 'warn',
      comment: 'No circular dependencies',
      from: {},
      to: {
        circular: true
      }
    },
    /* detect orphan modules (not imported by anyone) */
    {
      name: 'no-orphans',
      severity: 'warn',
      comment: 'Orphan modules should be documented or removed',
      from: {
        orphan: true
      },
      to: {}
    },
    {
      name: 'no-domain-to-ui',
      comment: 'Domain layer must stay pure (no UI or route awareness)',
      severity: 'error',
      from: { path: '^src/domain/' },
      to: { path: '^src/(ui|app|components)/' }
    },
    {
      name: 'no-lib-to-ui',
      comment: 'Low-level lib/shared code must not depend on UI',
      severity: 'error',
      from: { path: '^src/(lib|shared)/' },
      to: { path: '^src/(ui|components)/' }
    },
    {
      name: 'no-server-leak',
      comment: 'Server (infrastructure) code must not import from presentation layers',
      severity: 'error',
      from: { path: '^src/server/' },
      to: { path: '^src/(app|ui|components)/' }
    },
    {
      name: 'no-upward-layer-imports-app',
      comment: 'Non-app layers must not import app route layer',
      severity: 'error',
      from: { path: '^src/(ui|components|domain|lib|shared|server)/' },
      to: { path: '^src/app/' }
    },
    {
      name: 'no-upward-layer-imports-ui',
      comment: 'Lower layers must not import UI layer',
      severity: 'error',
      from: { path: '^src/(domain|lib|shared|server)/' },
      to: { path: '^src/ui/' }
    },
    {
      name: 'no-legacy-components-imports',
      comment: 'Phase out legacy src/components usage in favor of src/ui; allow bridging wrappers only',
      severity: 'warn',
      from: { path: '^src/(app|ui|lib|domain|server)/' },
      to: { path: '^src/components/(?!DynamicComponents\\.tsx$)' }
    },
    {
      name: 'no-cross-feature-internals',
      comment: 'Feature internals (inventory/orders/marketing/etc) exposed only via their index/facade',
      severity: 'warn',
      from: { path: '^src/(app|ui|components)/' },
      to: { path: '^src/domain/(.+)/(?!index|facade)\\w+\\.(ts|tsx)$' }
    },
    {
      name: 'prefer-facade-marketing',
      comment: 'UI should import marketing only through facade',
      severity: 'warn',
      from: { path: '^src/(app|ui)/' },
      to: { path: '^src/domain/marketing/(services|repositories)/' }
    },
    {
      name: 'no-test-imports',
      comment: 'Production code must not import from test files',
      severity: 'error',
      from: { path: '^src/(?!tests/).*' },
      to: { path: '^src/tests/' }
    },
    {
      name: 'no-deep-relative-traversal',
      comment: 'Discourage brittle deep ../../ relative imports – use path aliases',
      severity: 'warn',
      from: { path: '^src/' },
      to: { path: '^\\.\\./\\.\\./' }
    },
    {
      name: 'enforce-alias-for-ui',
      comment: 'UI modules should be imported via @ui/* alias (no long relative paths)',
      severity: 'info',
      from: { path: '^src/(app|ui)/' },
      to: { path: '^src/ui/', pathNot: '^src/ui/components/(?:index\\.ts)?$' }
    },
    {
      name: 'no-orphan-allowlist',
      comment: 'Explicitly allow known intentional entry-point or framework orphans; warn on others',
      severity: 'warn',
      from: { orphan: true, pathNot: '^src/(middleware|instrumentation|app/robots|app/api/og|types/.*d\\.ts)$' },
      to: {}
    },
    {
      name: 'no-shared-to-domain-backref',
      comment: 'Shared utilities should not depend on domain logic (keep shared lowest)',
      severity: 'error',
      from: { path: '^src/shared/' },
      to: { path: '^src/domain/' }
    },
    {
      name: 'no-circular-critical',
      comment: 'Escalate circulars in domain & lib to error',
      severity: 'error',
      from: { path: '^src/(domain|lib)/' },
      to: { circular: true }
    },
    {
      name: 'ui-no-server-alias',
      comment: 'UI must not import @server alias directly',
      severity: 'error',
      from: { path: '^src/ui/' },
      to: { path: '^@server/' }
    },
    {
      name: 'no-repo-direct-in-ui',
      comment: 'UI must not touch *repo.ts directly (use service/facade)',
      severity: 'error',
      from: { path: '^src/ui/' },
      to: { path: 'repo\\.ts$' }
    },
    {
      name: 'no-service-direct-in-app',
      comment: 'Route layer should consume only facades or index barrels (not raw services)',
      severity: 'warn',
      from: { path: '^src/app/' },
      to: { path: 'service\\.ts$' }
    }
  ]
};