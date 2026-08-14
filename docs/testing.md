# Testing Suite Documentation

## Overview
The Artist Site project includes a comprehensive testing suite built with Jest and React Testing Library. The testing infrastructure provides unit tests, integration tests, and component tests with coverage reporting.

## Test Structure

### Configuration
- **Jest Config**: `jest.config.js` - Main Jest configuration with Next.js integration
- **Setup File**: `jest.setup.js` - Global test setup, mocks, and utilities
- **Coverage**: Configured for 50% minimum coverage across statements, branches, functions, and lines

### Test Categories

#### Component Tests (`src/tests/components/`)
- **Header.test.tsx** - Navigation component testing
- **Footer.test.tsx** - Footer content and styling
- **NewsletterSignup.test.tsx** - Form validation and submission
- **ErrorBoundary.test.tsx** - Error handling and display
- **PreviewBanner.test.tsx** - Draft preview functionality

#### Library Tests (`src/tests/`)
- **markdown.test.ts** - MDX processing and blog post functions
- **commerce.test.ts** - Product catalog and e-commerce utilities
- **api-error-handler.test.ts** - API error handling middleware

#### Integration Tests

- **api-integration.test.ts** - API endpoint testing (checkout, orders, marketing, inventory, contact, newsletter, preview, and public config)

### Test Utilities
- **test-utils.tsx** - Custom render functions and mock data factories
- Shared mocks for Next.js router, fetch, and Web APIs

## Running Tests

### Development Commands
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run tests for CI
npm run test:ci
```

### Coverage Reports
- **Text output** - Console summary
- **HTML report** - `coverage/lcov-report/index.html`
- **LCOV format** - For CI/CD integration

## Current Coverage Status
- **Statements**: 26.29%
- **Branches**: 21.89% 
- **Functions**: 25.13%
- **Lines**: 26.79%

### Covered Areas
✅ Core library functions (markdown, commerce)  
✅ Component rendering and basic interactions  
✅ API error handling  
✅ Form validation logic  

### Areas for Improvement
⚠️ Page components (blog, portfolio, shop)  
⚠️ Debug utilities  
⚠️ Server-side rendering paths  
⚠️ Advanced user interactions  

## Mocking Strategy

### Global Mocks
- **Next.js Router** - All navigation functions mocked
- **fetch** - Global fetch mock for API calls
- **Web APIs** - Request, Response, Headers for Node.js environment

### Component-Specific Mocks
- **Next/Image** - Renders as standard img tag
- **Console methods** - Filtered to reduce test noise
- **Environment variables** - Isolated for each test

## Best Practices

### Test Organization
1. Group tests by component/feature
2. Use descriptive test names
3. Follow AAA pattern (Arrange, Act, Assert)
4. Mock external dependencies

### Data Management
- Use factory functions for mock data
- Isolate test state between runs
- Clean up mocks in beforeEach/afterEach

### Assertions
- Focus on user-visible behavior
- Test accessibility attributes
- Verify error states and edge cases

## Troubleshooting

### Common Issues
1. **Module resolution** - Check Jest moduleNameMapping
2. **Async operations** - Use waitFor for state changes
3. **Router mocks** - Ensure all router functions are mocked
4. **Environment isolation** - Reset process.env in tests

### Debug Tips
- Use `screen.debug()` to inspect rendered output
- Check coverage reports for untested paths
- Use `--verbose` flag for detailed test output

## Future Enhancements

### Planned Additions
- [ ] Visual regression testing with Playwright
- [ ] E2E tests for critical user journeys
- [ ] Performance testing for MDX rendering
- [ ] Accessibility testing automation

### Integration Opportunities
- [ ] GitHub Actions CI/CD pipeline
- [ ] Code quality gates
- [ ] Automated dependency updates
- [ ] Security vulnerability scanning

## Contributing
When adding new features:
1. Write tests before implementation (TDD)
2. Maintain or improve coverage percentage
3. Update test documentation
4. Consider edge cases and error scenarios