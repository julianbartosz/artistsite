# Artist Site - Professional Art Portfolio & E-commerce Platform

A modern, high-performance artist portfolio website built with Next.js, featuring a blog, portfolio showcase, e-commerce shop, and comprehensive analytics. Designed for artists who want a professional web presence without the complexity of traditional CMS platforms.

## 🎨 Features

### Core Functionality
- **Portfolio Gallery**: MDX-powered artwork showcase with filtering and detail pages
- **Blog System**: Professional blog with MDX content, preview mode, and SEO optimization
- **E-commerce Shop**: Full shopping cart, Stripe integration, order management
- **Newsletter Integration**: Mailchimp integration with automated campaigns
- **Contact & Bio Pages**: Professional artist biography and commission inquiry system

### Technical Highlights
- **Performance Optimized**: Core Web Vitals monitoring, ISR, image optimization
- **SEO Enhanced**: Dynamic sitemaps, structured data, Open Graph optimization
- **Analytics & Marketing**: GA4 integration, customer insights, email automation
- **Admin Dashboard**: Content management, performance monitoring, customer analytics
- **Production Ready**: Full CI/CD pipeline, Docker deployment, monitoring

## 🚀 Quick Start

### Development Setup
```bash
# Clone and install dependencies
git clone <repository-url>
cd ArtistSite
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your configuration

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the site.

### Environment Variables
```bash
# Required for production
NEXTAUTH_SECRET=your-secret-here
STRIPE_SECRET_KEY=sk_test_...
MAILCHIMP_API_KEY=your-api-key
GA_MEASUREMENT_ID=G-XXXXXXXXXX

# Development only
NEXT_PUBLIC_PREVIEW_SECRET=your-preview-secret
DATABASE_URL=postgresql://...
```

## 🛠 Tech Stack

### Frontend
- **Framework**: Next.js 13+ (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Content**: MDX for blog posts and static content

### Backend
- **Runtime**: Node.js 18
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js
- **Payments**: Stripe
- **Email**: Mailchimp/SendGrid

### DevOps
- **Containerization**: Docker & Docker Compose
- **CI/CD**: GitHub Actions
- **Hosting**: Azure Container Instances
- **Monitoring**: Custom analytics dashboard

## 📁 Project Structure

```
src/
├── app/                 # Next.js App Router pages
│   ├── (auth)/         # Authentication pages
│   ├── admin/          # Admin dashboard
│   ├── api/            # API routes
│   ├── blog/           # Blog pages
│   ├── portfolio/      # Portfolio pages
│   └── shop/           # E-commerce pages
├── components/         # Reusable UI components
├── content/           # MDX content files
├── lib/               # Utilities and shared logic
├── styles/            # CSS and styling
└── types/             # TypeScript definitions

copilot_docs/          # AI development documentation
memory-bank/           # Project memory and context
```

## 🧪 Development

### Available Scripts
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run test         # Run test suite
npm run test:watch   # Run tests in watch mode
npm run type-check   # TypeScript checking
npm run lint         # ESLint checking
```

### Testing
- **Framework**: Jest + React Testing Library
- **Coverage**: HTML reports are available; see `docs/testing.md` for the current measured coverage and known gaps
- **E2E Tests**: Comprehensive user flow testing
```bash
npm run test              # Run all tests
npm run test:coverage     # Generate coverage report
```

### Debugging
- **Debug Dashboard**: Visit `/debug` in development
- **Performance Monitor**: Add `?perf=true` to any page
- **SEO Analysis**: Add `?seo=true` to any page
- **Error Tracking**: Comprehensive error boundaries and logging

## 🚢 Deployment

### Staging Deployment
```bash
# Automatic deployment on push to main
git push origin main

# Manual staging deployment
npm run deploy:staging
```

### Production Deployment
```bash
# Tagged releases trigger production deployment
git tag v1.0.0
git push origin v1.0.0

# Manual production deployment
npm run deploy:production
```

### Docker
```bash
# Local development with Docker
docker-compose up

# Production build
docker build -t artist-site .
docker run -p 3000:3000 artist-site
```

## 📊 Monitoring & Analytics

### Performance Monitoring
- **Core Web Vitals**: Real-time LCP, INP, CLS tracking
- **Performance Dashboard**: Available at `/debug/monitoring`
- **Lighthouse CI**: Automated performance testing

### Business Analytics
- **Google Analytics 4**: Comprehensive e-commerce tracking
- **Customer Insights**: Behavioral analysis and segmentation
- **Email Analytics**: Campaign performance and automation

## 🎯 Current Status

### Completed Features ✅
- Core website functionality (blog, portfolio, shop)
- E-commerce with Stripe integration
- Admin dashboard and content management
- SEO optimization and analytics
- CI/CD pipeline and deployment
- Performance optimization

### Next Phase: Debugging & Optimization 🔧
Focus on debugging, performance optimization, and production readiness.

## 🤝 Contributing

### Development Workflow
1. Create feature branch from `main`
2. Make changes with comprehensive tests
3. Run `npm run test` and `npm run type-check`
4. Submit PR with clear description

### Code Quality
- TypeScript for type safety
- ESLint + Prettier for code formatting
- Jest + RTL for testing
- Conventional commits for clear history

## 📄 License

This project is proprietary. All rights reserved.

## 🆘 Support

- **Documentation**: Check `copilot_docs/` and `memory-bank/` folders
- **Issues**: Use GitHub Issues for bug reports
- **Debug Tools**: Use `/debug` dashboard in development
- **Performance**: Monitor Core Web Vitals dashboard

---

Built with ❤️ using Next.js, TypeScript, and modern web technologies.
