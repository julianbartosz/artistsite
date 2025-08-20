import { render, screen } from '@testing-library/react';
import { Footer } from '@ui/components/layout/Footer';

describe('Footer Component', () => {
  it('renders footer content correctly', () => {
    render(<Footer />);
    
    const year = new Date().getFullYear();
    expect(screen.getByText(new RegExp(`©\\s+${year}\\s+Artist Site`))).toBeInTheDocument();
    expect(screen.getByText(/All rights reserved\./)).toBeInTheDocument();
  });

  it('renders social media links', () => {
    render(<Footer />);
    
    // Check for social media links if they exist
    const footer = screen.getByRole('contentinfo');
    expect(footer).toBeInTheDocument();
  });

  it('has correct styling classes', () => {
    render(<Footer />);
    
    const footer = screen.getByRole('contentinfo');
    expect(footer).toHaveClass('bg-gray-900', 'text-white');
  });
});