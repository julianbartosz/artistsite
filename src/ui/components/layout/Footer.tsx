import Link from 'next/link';
import { IconInstagram, IconTwitter, IconEmail } from '@ui/icons/social';

export function Footer() {
  const currentYear = new Date().getFullYear();
  const footerLinks = {
    main: [
      { name: 'Portfolio', href: '/portfolio' },
      { name: 'Blog', href: '/blog' },
      { name: 'Shop', href: '/shop' },
      { name: 'Contact', href: '/contact' },
    ],
    legal: [
      { name: 'Privacy Policy', href: '/privacy' },
      { name: 'Terms of Service', href: '/terms' },
    ],
    social: [
      { name: 'Instagram', href: '#', icon: 'instagram' as const },
      { name: 'Twitter', href: '#', icon: 'twitter' as const },
      { name: 'Email', href: 'mailto:hello@artistsite.com', icon: 'email' as const },
    ],
  };

  const SocialIcon = ({ icon }: { icon: 'instagram' | 'twitter' | 'email' }) => {
    switch (icon) {
      case 'instagram':
        return <IconInstagram className="w-5 h-5" />;
      case 'twitter':
        return <IconTwitter className="w-5 h-5" />;
      case 'email':
        return <IconEmail className="w-5 h-5" />;
    }
  };

  return (
    <footer className="bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand & Description */}
          <div className="md:col-span-2">
            <h3 className="text-2xl font-bold mb-4">Artist Site</h3>
            <p className="text-gray-300 mb-6 max-w-md">
              Contemporary paintings and drawings exploring the intersection of 
              urban landscapes, abstract form, and the ever-changing quality of light.
            </p>
            <div className="flex space-x-4">
              {footerLinks.social.map((item) => (
                <a
                  key={item.name}
                  href={item.href}
                  className="text-gray-400 hover:text-white transition-colors"
                  aria-label={item.name}
                >
                  <SocialIcon icon={item.icon} />
                </a>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-lg font-semibold mb-4">Quick Links</h4>
            <ul className="space-y-2">
              {footerLinks.main.map((item) => (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className="text-gray-300 hover:text-white transition-colors"
                  >
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-lg font-semibold mb-4">Legal</h4>
            <ul className="space-y-2">
              {footerLinks.legal.map((item) => (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className="text-gray-300 hover:text-white transition-colors"
                  >
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-gray-800 mt-8 pt-8 flex flex-col sm:flex-row justify-between items-center">
          <p className="text-gray-400 text-sm">
            © {currentYear} Artist Site. All rights reserved.
          </p>
          <p className="text-gray-400 text-sm mt-2 sm:mt-0">
            Built with passion and creativity
          </p>
        </div>
      </div>
    </footer>
  );
}
