'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { formatPrice } from '@/lib/commerce';
import { mergeGuestWishlistIntoAccount } from '@/components/WishlistButton';
import RecentlyViewed from '@/components/RecentlyViewed';

type AccountTab = 'overview' | 'orders' | 'wishlist' | 'recent';

type Profile = {
  email: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  createdAt: string;
};

type OrderItem = {
  id: string;
  product?: { title?: string };
  title?: string;
  unitPrice?: number;
  price?: number;
  quantity: number;
};

type Order = {
  id: string;
  orderNumber?: string;
  total: number;
  status: string;
  createdAt: string;
  items: OrderItem[];
};

type WishlistItem = {
  id: string;
  productId: string;
  productTitle: string;
  productImage: string;
  productPrice: number;
};

const TAB_LABELS: Record<AccountTab, string> = {
  overview: 'Overview',
  orders: 'Orders',
  wishlist: 'Wishlist',
  recent: 'Recently Viewed',
};

export default function AccountDashboard() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<AccountTab>('overview');
  const [orders, setOrders] = useState<Order[]>([]);
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [profileForm, setProfileForm] = useState({ firstName: '', lastName: '', phone: '' });
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);

  useEffect(() => {
    if (status === 'loading') return;

    if (!session) {
      router.push('/auth/signin?callbackUrl=/account');
      return;
    }

    let cancelled = false;

    async function loadAccount() {
      setIsLoading(true);
      try {
        await mergeGuestWishlistIntoAccount();

        const [profileRes, ordersRes, wishlistRes] = await Promise.all([
          fetch('/api/account/profile', { cache: 'no-store' }),
          fetch('/api/orders', { cache: 'no-store' }),
          fetch('/api/wishlist', { cache: 'no-store' }),
        ]);

        if (cancelled) return;

        if (profileRes.ok) {
          const profileData = await profileRes.json();
          if (profileData.profile) {
            setProfile(profileData.profile);
            setProfileForm({
              firstName: profileData.profile.firstName || '',
              lastName: profileData.profile.lastName || '',
              phone: profileData.profile.phone || '',
            });
          }
        }

        if (ordersRes.ok) {
          const ordersData = await ordersRes.json();
          setOrders(ordersData.orders || []);
        }

        if (wishlistRes.ok) {
          const wishlistData = await wishlistRes.json();
          setWishlist(wishlistData.items || []);
        }
      } catch (error) {
        console.error('Failed to load account data:', error);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadAccount();

    return () => {
      cancelled = true;
    };
  }, [session, status, router]);

  async function removeWishlistItem(productId: string) {
    const response = await fetch(`/api/wishlist/${encodeURIComponent(productId)}`, { method: 'DELETE' });
    if (response.ok) {
      setWishlist((current) => current.filter((item) => item.productId !== productId));
    }
  }

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    setProfileSaving(true);
    setProfileMessage(null);

    try {
      const response = await fetch('/api/account/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileForm),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update profile');
      }

      setProfile(data.profile);
      setProfileMessage('Profile updated.');
      await update();
    } catch (error) {
      setProfileMessage(error instanceof Error ? error.message : 'Failed to update profile');
    } finally {
      setProfileSaving(false);
    }
  }

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary" />
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const memberSince = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : '—';

  return (
    <div className="min-h-screen bg-gray-50 py-8 md:py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-200 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">My Account</h1>
              <p className="text-gray-600">Welcome back, {profile?.name || session.user?.name || session.user?.email}</p>
            </div>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: '/' })}
              className="self-start sm:self-auto bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-md text-sm font-medium transition-colors"
            >
              Sign Out
            </button>
          </div>

          <div className="border-b border-gray-200 px-4 sm:px-6">
            <nav className="flex gap-4 overflow-x-auto" aria-label="Account sections">
              {(Object.keys(TAB_LABELS) as AccountTab[]).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`py-4 text-sm font-medium border-b-2 whitespace-nowrap ${
                    activeTab === tab
                      ? 'border-primary text-primary'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {TAB_LABELS[tab]}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'overview' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 bg-gray-50 rounded-lg p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Profile</h2>
                  <form onSubmit={saveProfile} className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500">Email</label>
                      <p className="text-gray-900">{profile?.email || session.user?.email}</p>
                    </div>
                    <div>
                      <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">First name</label>
                      <input
                        id="firstName"
                        value={profileForm.firstName}
                        onChange={(event) => setProfileForm((current) => ({ ...current, firstName: event.target.value }))}
                        className="mt-1 w-full form-input"
                      />
                    </div>
                    <div>
                      <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">Last name</label>
                      <input
                        id="lastName"
                        value={profileForm.lastName}
                        onChange={(event) => setProfileForm((current) => ({ ...current, lastName: event.target.value }))}
                        className="mt-1 w-full form-input"
                      />
                    </div>
                    <div>
                      <label htmlFor="phone" className="block text-sm font-medium text-gray-700">Phone</label>
                      <input
                        id="phone"
                        value={profileForm.phone}
                        onChange={(event) => setProfileForm((current) => ({ ...current, phone: event.target.value }))}
                        className="mt-1 w-full form-input"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Member since</label>
                      <p className="text-gray-900">{memberSince}</p>
                    </div>
                    {profileMessage && (
                      <p className={`text-sm ${profileMessage.includes('updated') ? 'text-green-700' : 'text-red-700'}`}>
                        {profileMessage}
                      </p>
                    )}
                    <button type="submit" disabled={profileSaving} className="btn-primary w-full px-4 py-2 rounded-md disabled:opacity-50">
                      {profileSaving ? 'Saving...' : 'Save Profile'}
                    </button>
                  </form>
                </div>

                <div className="lg:col-span-2 space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <button type="button" onClick={() => setActiveTab('orders')} className="rounded-lg border border-gray-200 p-4 text-left hover:border-primary transition-colors">
                      <p className="text-sm text-gray-500">Orders</p>
                      <p className="text-2xl font-semibold text-gray-900">{orders.length}</p>
                    </button>
                    <button type="button" onClick={() => setActiveTab('wishlist')} className="rounded-lg border border-gray-200 p-4 text-left hover:border-primary transition-colors">
                      <p className="text-sm text-gray-500">Saved works</p>
                      <p className="text-2xl font-semibold text-gray-900">{wishlist.length}</p>
                    </button>
                    <div className="rounded-lg border border-gray-200 p-4">
                      <p className="text-sm text-gray-500">Account</p>
                      <p className="text-sm font-medium text-gray-900">{session.user?.isAdmin ? 'Artist / Admin' : 'Collector'}</p>
                    </div>
                  </div>

                  <div className="rounded-lg border border-gray-200 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick actions</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <Link href="/shop" className="btn-primary-outline px-4 py-3 rounded-md text-center text-sm">Browse shop</Link>
                      <Link href="/portfolio" className="btn-primary-outline px-4 py-3 rounded-md text-center text-sm">View portfolio</Link>
                      <Link href="/contact" className="btn-primary-outline px-4 py-3 rounded-md text-center text-sm">Contact studio</Link>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'orders' && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Purchase history</h2>
                {orders.length === 0 ? (
                  <div className="text-center py-10">
                    <h3 className="text-sm font-medium text-gray-900 mb-2">No orders yet</h3>
                    <p className="text-sm text-gray-500 mb-4">When you purchase artwork, your order history will appear here.</p>
                    <Link href="/shop" className="btn-primary px-4 py-2 rounded-md inline-block">Browse shop</Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {orders.map((order) => (
                      <div key={order.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                          <div>
                            <Link href={`/orders/${order.id}`} className="text-sm font-medium text-primary hover:opacity-80">
                              Order #{order.orderNumber || order.id}
                            </Link>
                            <p className="text-sm text-gray-500">{new Date(order.createdAt).toLocaleDateString()}</p>
                          </div>
                          <div className="text-left sm:text-right">
                            <p className="text-sm font-medium text-gray-900">{formatPrice(order.total)}</p>
                            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800 capitalize">
                              {order.status}
                            </span>
                          </div>
                        </div>
                        <div className="border-t border-gray-200 pt-3 space-y-1">
                          {order.items.map((item) => (
                            <div key={item.id} className="flex justify-between text-sm text-gray-700">
                              <span>{item.product?.title || item.title || 'Artwork'} × {item.quantity}</span>
                              <span>{formatPrice((item.unitPrice ?? item.price ?? 0) * item.quantity)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'wishlist' && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Saved works</h2>
                {wishlist.length === 0 ? (
                  <div className="text-center py-10">
                    <h3 className="text-sm font-medium text-gray-900 mb-2">Your wishlist is empty</h3>
                    <p className="text-sm text-gray-500 mb-4">Tap the heart on any shop item to save it here.</p>
                    <Link href="/shop" className="btn-primary px-4 py-2 rounded-md inline-block">Explore shop</Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {wishlist.map((item) => (
                      <div key={item.id} className="border border-gray-200 rounded-lg overflow-hidden">
                        <Link href={`/shop/${item.productId}`} className="block">
                          <div className="relative aspect-square bg-gray-100">
                            <Image src={item.productImage} alt={item.productTitle} fill className="object-cover" sizes="(max-width: 768px) 100vw, 33vw" />
                          </div>
                          <div className="p-4">
                            <h3 className="font-medium text-gray-900 line-clamp-2">{item.productTitle}</h3>
                            <p className="text-sm text-gray-600 mt-1">{formatPrice(item.productPrice)}</p>
                          </div>
                        </Link>
                        <div className="px-4 pb-4">
                          <button
                            type="button"
                            onClick={() => void removeWishlistItem(item.productId)}
                            className="text-sm text-gray-600 hover:text-red-600"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'recent' && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Recently viewed</h2>
                <RecentlyViewed maxItems={8} showEmptyState showHeading={false} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
