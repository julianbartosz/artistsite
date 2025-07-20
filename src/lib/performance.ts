// Critical CSS utilities for performance optimization

export function generateCriticalCSS() {
  return `
    /* Critical above-the-fold styles */
    html, body {
      margin: 0;
      padding: 0;
      font-family: var(--font-geist-sans), system-ui, sans-serif;
      line-height: 1.6;
      color: #1f2937;
    }
    
    /* Header critical styles */
    header {
      position: sticky;
      top: 0;
      z-index: 50;
      background: white;
      border-bottom: 1px solid #e5e7eb;
    }
    
    /* Navigation critical styles */
    nav {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem 1.5rem;
      max-width: 1200px;
      margin: 0 auto;
    }
    
    /* Hero section critical styles */
    .hero {
      padding: 4rem 1.5rem;
      text-align: center;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      min-height: 60vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    /* Typography critical styles */
    h1 {
      font-size: 3rem;
      font-weight: 700;
      line-height: 1.1;
      margin: 0 0 1rem 0;
    }
    
    /* Button critical styles */
    .btn-primary {
      background: #3b82f6;
      color: white;
      padding: 0.75rem 1.5rem;
      border-radius: 0.5rem;
      text-decoration: none;
      display: inline-block;
      font-weight: 600;
      transition: background-color 0.2s;
    }
    
    .btn-primary:hover {
      background: #2563eb;
    }
    
    /* Layout critical styles */
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 1.5rem;
    }
    
    /* Grid critical styles */
    .grid {
      display: grid;
      gap: 2rem;
    }
    
    @media (min-width: 768px) {
      .grid-cols-2 {
        grid-template-columns: repeat(2, 1fr);
      }
      
      .grid-cols-3 {
        grid-template-columns: repeat(3, 1fr);
      }
    }
    
    /* Loading states */
    .loading {
      opacity: 0;
      transform: translateY(20px);
      transition: opacity 0.3s, transform 0.3s;
    }
    
    .loaded {
      opacity: 1;
      transform: translateY(0);
    }
  `;
}

export function injectCriticalCSS() {
  if (typeof document === 'undefined') return;
  
  const criticalStyles = generateCriticalCSS();
  const styleElement = document.createElement('style');
  styleElement.innerHTML = criticalStyles;
  styleElement.setAttribute('data-critical', 'true');
  
  // Insert before other stylesheets
  document.head.insertBefore(styleElement, document.head.firstChild);
}

// Preload critical resources
export function preloadCriticalResources() {
  if (typeof document === 'undefined') return;
  
  const criticalResources = [
    '/images/artist-portrait.jpg',
    '/images/logo.png',
    '/fonts/Inter-Bold.ttf',
  ];
  
  criticalResources.forEach(resource => {
    const link = document.createElement('link');
    link.rel = 'preload';
    
    if (resource.endsWith('.jpg') || resource.endsWith('.png')) {
      link.as = 'image';
    } else if (resource.endsWith('.ttf') || resource.endsWith('.woff2')) {
      link.as = 'font';
      link.type = 'font/ttf';
      link.crossOrigin = 'anonymous';
    }
    
    link.href = resource;
    document.head.appendChild(link);
  });
}

// Lazy load non-critical CSS
export function loadNonCriticalCSS() {
  if (typeof document === 'undefined') return;
  
  // Load non-critical styles after page load
  const nonCriticalStyles = [
    '/styles/animations.css',
    '/styles/components.css',
  ];
  
  nonCriticalStyles.forEach(href => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.media = 'print';
    link.onload = function() {
      (this as HTMLLinkElement).media = 'all';
    };
    document.head.appendChild(link);
  });
}

// Performance optimization helpers
export function optimizeImages() {
  if (typeof document === 'undefined') return;
  
  // Add intersection observer for lazy loading
  const imageObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target as HTMLImageElement;
        if (img.dataset.src) {
          img.src = img.dataset.src;
          img.classList.remove('loading');
          img.classList.add('loaded');
          observer.unobserve(img);
        }
      }
    });
  });
  
  // Observe all images with data-src
  document.querySelectorAll('img[data-src]').forEach(img => {
    imageObserver.observe(img);
  });
}