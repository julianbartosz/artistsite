import { NewsletterSignup } from '@/components/NewsletterSignup';

export default function SubscribePage() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-6">
      <div className="max-w-xl mx-auto text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Subscribe for Studio Updates</h1>
        <p className="text-gray-600 mb-8">Get new artwork, exhibition notes, and behind-the-scenes posts by email.</p>
        <NewsletterSignup />
      </div>
    </div>
  );
}