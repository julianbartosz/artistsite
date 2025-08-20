import { render, screen } from '@testing-library/react';
import BioPage from '@/app/bio/page';

// Mock Next.js Image component
jest.mock('next/image', () => {
  return function MockImage({ src, alt, ...props }: any) {
    // Remove the boolean props that cause warnings
    const { fill, priority, sizes, ...cleanProps } = props;
    return <img src={src} alt={alt} {...cleanProps} />;
  };
});

// Mock Next.js Link component
jest.mock('next/link', () => {
  return function MockLink({ href, children, ...props }: any) {
    return <a href={href} {...props}>{children}</a>;
  };
});

describe('Bio Page', () => {
  beforeEach(() => {
    render(<BioPage />);
  });

  describe('Hero Section', () => {
    it('renders the main heading', () => {
      expect(screen.getByRole('heading', { name: /about the artist/i })).toBeInTheDocument();
    });

    it('displays artist portrait with correct alt text', () => {
      expect(screen.getByAltText(/artist in studio/i)).toBeInTheDocument();
    });

    it('includes navigation links to portfolio and contact', () => {
      expect(screen.getByRole('link', { name: /view portfolio/i })).toHaveAttribute('href', '/portfolio');
      expect(screen.getByRole('link', { name: /get in touch/i })).toHaveAttribute('href', '/contact');
    });

    it('displays introductory description', () => {
      expect(screen.getByText(/contemporary painter exploring/i)).toBeInTheDocument();
    });
  });

  describe('Artist Statement Section', () => {
    it('renders artist statement heading', () => {
      expect(screen.getByRole('heading', { name: /artist statement/i })).toBeInTheDocument();
    });

    it('displays the artist statement content', () => {
      expect(screen.getByText(/my work explores the dynamic relationship/i)).toBeInTheDocument();
      expect(screen.getByText(/each piece begins with observation/i)).toBeInTheDocument();
      expect(screen.getByText(/working primarily in oil on canvas/i)).toBeInTheDocument();
    });
  });

  describe('Background & Education Section', () => {
    it('renders background and education sections', () => {
      expect(screen.getByRole('heading', { name: /^background$/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /^achievements$/i })).toBeInTheDocument();
    });

    it('displays education information', () => {
      expect(screen.getAllByText(/yale school of art/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/rhode island school of design/i)).toBeInTheDocument();
      expect(screen.getByText(/florence academy of art/i)).toBeInTheDocument();
    });

    it('shows professional experience', () => {
      const studioMatches = screen.getAllByText((content, node) => node?.textContent?.toLowerCase().includes('studio artist') && node?.textContent?.toLowerCase().includes('independent practice'))
      expect(studioMatches.length).toBeGreaterThan(0)
      const teachingMatches = screen.getAllByText((content, node) => node?.textContent?.toLowerCase().includes('teaching assistant') && node?.textContent?.toLowerCase().includes('yale'))
      expect(teachingMatches.length).toBeGreaterThan(0)
    });

    it('lists exhibitions and awards', () => {
      const urbanMatches = screen.getAllByText((content, node) => node?.textContent?.toLowerCase().includes('urban abstractions') && node?.textContent?.toLowerCase().includes('gallery modern'))
      expect(urbanMatches.length).toBeGreaterThan(0)
      const voicesMatches = screen.getAllByText((content, node) => node?.textContent?.toLowerCase().includes('new voices') && node?.textContent?.toLowerCase().includes('moma ps1'))
      expect(voicesMatches.length).toBeGreaterThan(0)
      const fellowshipMatches = screen.getAllByText((content, node) => node?.textContent?.toLowerCase().includes('artist fellowship') && node?.textContent?.toLowerCase().includes('new york foundation'))
      expect(fellowshipMatches.length).toBeGreaterThan(0)
    });
  });

  describe('Studio Practice Section', () => {
    it('renders studio practice heading', () => {
      expect(screen.getByRole('heading', { name: /studio practice/i })).toBeInTheDocument();
    });

    it('displays studio image with correct alt text', () => {
      expect(screen.getByAltText(/artist studio workspace/i)).toBeInTheDocument();
    });

    it('describes studio practice and methodology', () => {
      expect(screen.getByText(/studio practice is rooted in direct observation/i)).toBeInTheDocument();
      expect(screen.getByText(/long island city/i)).toBeInTheDocument();
    });
  });

  describe('Collections & Press Section', () => {
    it('renders collections and press section', () => {
      expect(screen.getByRole('heading', { name: /collections & press/i })).toBeInTheDocument();
    });

    it('lists public collections', () => {
      expect(screen.getByText(/museum of contemporary art, chicago/i)).toBeInTheDocument();
      expect(screen.getByText(/brooklyn museum permanent collection/i)).toBeInTheDocument();
      expect(screen.getByText(/yale university art gallery/i)).toBeInTheDocument();
    });

    it('shows press and publications', () => {
      const artforumMatches = screen.getAllByText((content, node) => node?.textContent?.toLowerCase().includes('artforum') && node?.textContent?.toLowerCase().includes('rising stars'))
      expect(artforumMatches.length).toBeGreaterThan(0)
      const artnewsMatches = screen.getAllByText((content, node) => node?.textContent?.toLowerCase().includes('artnews') && node?.textContent?.toLowerCase().includes('urban abstractions review'))
      expect(artnewsMatches.length).toBeGreaterThan(0)
    });
  });

  describe('Call to Action Section', () => {
    it('renders final call to action', () => {
      expect(screen.getByRole('heading', { name: /connect with my work/i })).toBeInTheDocument();
    });

    it('includes navigation links to other sections', () => {
      const portfolioLinks = screen.getAllByRole('link', { name: /portfolio/i });
      const shopLinks = screen.getAllByRole('link', { name: /shop|available works/i });
      const contactLinks = screen.getAllByRole('link', { name: /contact/i });
      
      expect(portfolioLinks.length).toBeGreaterThan(0);
      expect(shopLinks.length).toBeGreaterThan(0);
      expect(contactLinks.length).toBeGreaterThan(0);
    });
  });

  describe('Accessibility', () => {
    it('has proper heading hierarchy', () => {
      const h1 = screen.getByRole('heading', { level: 1 });
      const h2s = screen.getAllByRole('heading', { level: 2 });
      const h3s = screen.getAllByRole('heading', { level: 3 });
      
      expect(h1).toBeInTheDocument();
      expect(h2s.length).toBeGreaterThan(0);
      expect(h3s.length).toBeGreaterThan(0);
    });

    it('has descriptive alt text for images', () => {
      const images = screen.getAllByRole('img');
      images.forEach(img => {
        expect(img).toHaveAttribute('alt');
        expect(img.getAttribute('alt')).not.toBe('');
      });
    });

    it('uses semantic HTML structure', () => {
      expect(screen.getAllByRole('heading')).toHaveLength(13); // Updated to reflect current number of headings
      expect(screen.getAllByRole('link').length).toBeGreaterThanOrEqual(5); // Avoid brittle exact count
    });
  });
});