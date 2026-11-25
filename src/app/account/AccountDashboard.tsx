'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import OptimizedImage from '@/components/OptimizedImage';
import { formatPrice } from '@/lib/commerce';
import { orderStatusLabel } from '@/lib/order-status-shared';
import { evictWishlistCacheItem, mergeGuestWishlistIntoAccount } from '@/components/WishlistButton';
import RecentlyViewed from '@/components/RecentlyViewed';
import StudioInboxPanel from '@/components/StudioInboxPanel';
import SavedUpdatesPanel from '@/components/SavedUpdatesPanel';
import OrderMessageComposer from '@/components/OrderMessageComposer';
import OrderStatusStepper from '@/components/admin/OrderStatusStepper';
import CollectorFeedLink from '@/components/CollectorFeedLink';

type AccountTab = 'overview' | 'orders' | 'wishlist' | 'recent' | 'messages' | 'saved';

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
  overview: 'Collection',
  orders: 'Orders',
  wishlist: 'Wishlist',
  saved: 'Saved updates',
  messages: 'Messages',
  recent: 'Recently viewed',
};

const TAB_ORDER: AccountTab[] = ['overview', 'orders', 'wishlist', 'saved', 'messages', 'recent'];

export default function AccountDashboard() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const activeTab: AccountTab = tabParam === 'orders' || tabParam === 'wishlist' || tabParam === 'recent' || tabParam === 'messages' || tabParam === 'saved'
    ? tabParam
    : 'overview';

  const selectTab = (tab: AccountTab) => {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === 'overview') params.delete('tab');
    else params.set('tab', tab);
    const query = params.toString();
    router.replace(query ? `/account?${query}` : '/account', { scroll: false });
  };
  const [orders, setOrders] = useState<Order[]>([]);
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ firstName: '', lastName: '', phone: '' });
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [messageSummary, setMessageSummary] = useState({ total: 0, unread: 0 });
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'loading') return;

    if (!session) {
      router.push('/auth/signin?callbackUrl=/account');
      return;
    }

    if (session.user?.isAdmin) {
      router.replace('/admin');
      return;
    }

    let cancelled = false;

    async function loadAccount() {
      setIsLoading(true);
      setLoadError(null);
      try {
        await mergeGuestWishlistIntoAccount();

        const [profileRes, ordersRes, wishlistRes, savedRes, messagesRes] = await Promise.all([
          fetch('/api/account/profile', { cache: 'no-store' }),
          fetch('/api/orders', { cache: 'no-store' }),
          fetch('/api/wishlist', { cache: 'no-store' }),
          fetch('/api/account/saved-updates', { cache: 'no-store' }),
          fetch('/api/account/messages', { cache: 'no-store' }),
        ]);

        if (cancelled) return;

        const failed: string[] = [];

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
        } else {
          failed.push('profile');
        }

        if (ordersRes.ok) {
          const ordersData = await ordersRes.json();
          setOrders(ordersData.orders || []);
        } else {
          failed.push('orders');
        }

        if (wishlistRes.ok) {
          const wishlistData = await wishlistRes.json();
          setWishlist(wishlistData.items || []);
        } else {
          failed.push('wishlist');
        }

        if (savedRes.ok) {
          const savedData = await savedRes.json();
          setSavedCount(Array.isArray(savedData.saved) ? savedData.saved.length : 0);
        } else {
          failed.push('saved updates');
        }

        if (messagesRes.ok) {
          const messagesData = await messagesRes.json();
          const threads = Array.isArray(messagesData.threads) ? messagesData.threads : [];
          const unread = threads.filter((entry: { unread?: boolean }) => Boolean(entry.unread)).length;
          setMessageSummary({ total: threads.length, unread });
        }

        if (failed.length > 0) {
          setLoadError(`Could not load ${failed.join(', ')}. Refresh to try again.`);
        }
      } catch (error) {
        console.error('Failed to load account data:', error);
        if (!cancelled) {
          setLoadError('Could not load your account. Refresh to try again.');
        }
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
      evictWishlistCacheItem(productId);
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
      setEditingProfile(false);
      await update();
    } catch (error) {
      setProfileMessage(error instanceof Error ? error.message : 'Failed to update profile');
    } finally {
      setProfileSaving(false);
    }
  }

  function startEditingProfile() {
    setProfileMessage(null);
    setProfileForm({
      firstName: profile?.firstName || '',
      lastName: profile?.lastName || '',
      phone: profile?.phone || '',
    });
    setEditingProfile(true);
  }

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen bg-surface-muted flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary" />
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const memberSince = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : '-';
  const fullName = (profile?.name || [profile?.firstName, profile?.lastName].filter(Boolean).join(' ') || session.user?.name || '').trim();
  const firstName = (profile?.firstName || fullName.split(/\s+/)[0] || '').trim();
  const latestOrder = orders[0] ?? null;
  const hasActivity = orders.length > 0 || wishlist.length > 0;

  return (
    <div className="min-h-screen bg-surface-muted py-6 md:py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-surface shadow-sm border border-gray-200/70 rounded-xl overflow-hidden">
          <div className="px-5 sm:px-6 py-5 sm:py-6 border-b border-gray-200 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                {firstName ? `Welcome, ${firstName}` : 'My Account'}
              </h1>
              <p className="mt-1 text-sm sm:text-base text-gray-600">
                Your collector space for orders, saved works, and studio messages.
              </p>
              {loadError && (
                <p className="mt-2 text-sm text-amber-800" role="alert">{loadError}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: '/' })}
              className="self-start sm:self-auto rounded-button border border-gray-300 bg-surface hover:bg-gray-50 text-gray-700 px-4 py-2 text-sm font-medium transition-colors"
            >
              Sign out
            </button>
          </div>

          <div className="border-b border-gray-200 px-4 sm:px-6">
            <nav
              className="flex gap-5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              aria-label="Account sections"
            >
              {TAB_ORDER.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => selectTab(tab)}
                  className={`relative py-3.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                    activeTab === tab
                      ? 'border-primary text-primary'
                      : 'border-transparent text-gray-500 hover:text-gray-800'
                  }`}
                >
                  <span className="inline-flex items-center gap-1.5">
                    {TAB_LABELS[tab]}
                    {tab === 'messages' && messageSummary.unread > 0 && (
                      <span className="inline-flex h-2 w-2 rounded-full bg-primary" aria-label={`${messageSummary.unread} unread`} />
                    )}
                  </span>
                </button>
              ))}
            </nav>
          </div>

          <div className="p-5 sm:p-6">
            {activeTab === 'overview' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 items-start">
                <div className="lg:col-span-2 space-y-6">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                    <button
                      type="button"
                      onClick={() => selectTab('orders')}
                      className="rounded-xl border border-gray-200 bg-surface p-4 text-left hover:border-primary/60 transition-colors"
                    >
                      <p className="text-xs font-medium text-gray-500">Orders</p>
                      <p className="mt-1 text-2xl font-semibold text-gray-900">{orders.length}</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => selectTab('wishlist')}
                      className="rounded-xl border border-gray-200 bg-surface p-4 text-left hover:border-primary/60 transition-colors"
                    >
                      <p className="text-xs font-medium text-gray-500">Wishlist</p>
                      <p className="mt-1 text-2xl font-semibold text-gray-900">{wishlist.length}</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => selectTab('saved')}
                      className="rounded-xl border border-gray-200 bg-surface p-4 text-left hover:border-primary/60 transition-colors"
                    >
                      <p className="text-xs font-medium text-gray-500">Saved updates</p>
                      <p className="mt-1 text-2xl font-semibold text-gray-900">{savedCount}</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => selectTab('messages')}
                      className="rounded-xl border border-gray-200 bg-surface p-4 text-left hover:border-primary/60 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <p className="text-xs font-medium text-gray-500">Messages</p>
                        {messageSummary.unread > 0 && (
                          <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                            {messageSummary.unread} new
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-2xl font-semibold text-gray-900">{messageSummary.total}</p>
                    </button>
                  </div>

                  {!hasActivity ? (
                    <div className="rounded-xl border border-primary/20 bg-surface-muted/70 p-6 sm:p-8">
                      <h2 className="text-xl font-semibold text-gray-900">Start your collection</h2>
                      <p className="mt-2 max-w-xl text-sm sm:text-base text-gray-600 leading-relaxed">
                        Explore original artworks and prints from the studio. Tap the heart on pieces you love to save them here, or write anytime with a question or commission idea.
                      </p>
                      <div className="mt-6 flex flex-wrap gap-3">
                        <Link href="/shop" className="btn-primary px-5 py-2.5 text-sm">Browse shop</Link>
                        <Link href="/portfolio" className="btn-primary-outline px-5 py-2.5 text-sm">View portfolio</Link>
                        <Link href="/updates" className="btn-primary-outline px-5 py-2.5 text-sm">Studio updates</Link>
                      </div>
                    </div>
                  ) : (
                    <>
                      {wishlist.length > 0 && (
                        <section className="rounded-xl border border-gray-200 p-5 sm:p-6">
                          <div className="flex items-center justify-between gap-3 mb-4">
                            <h2 className="text-lg font-semibold text-gray-900">Saved in your wishlist</h2>
                            <button
                              type="button"
                              onClick={() => selectTab('wishlist')}
                              className="text-sm font-medium text-primary hover:opacity-80"
                            >
                              View all →
                            </button>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            {wishlist.slice(0, 3).map((item) => (
                              <Link
                                key={item.id}
                                href={`/shop/${item.productId}`}
                                className="group block overflow-hidden rounded-lg border border-gray-200 hover:border-primary/50 transition-colors"
                              >
                                <div className="relative aspect-square bg-gray-100">
                                  <OptimizedImage
                                    src={item.productImage}
                                    alt={item.productTitle}
                                    variantSize="md"
                                    fill
                                    className="object-cover group-hover:scale-105 transition-transform duration-300 motion-reduce:transform-none"
                                    sizes="(max-width: 640px) 100vw, 25vw"
                                  />
                                </div>
                                <div className="p-3">
                                  <p className="text-sm font-medium text-gray-900 line-clamp-1">{item.productTitle}</p>
                                  <p className="mt-0.5 text-sm text-gray-600">{formatPrice(item.productPrice)}</p>
                                </div>
                              </Link>
                            ))}
                          </div>
                        </section>
                      )}

                      {latestOrder && (
                        <section className="rounded-xl border border-gray-200 p-5 sm:p-6">
                          <div className="flex items-center justify-between gap-3 mb-3">
                            <h2 className="text-lg font-semibold text-gray-900">Recent order</h2>
                            <button
                              type="button"
                              onClick={() => selectTab('orders')}
                              className="text-sm font-medium text-primary hover:opacity-80"
                            >
                              All orders →
                            </button>
                          </div>
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div>
                              <Link href={`/orders/${latestOrder.id}`} className="text-sm font-medium text-primary hover:opacity-80">
                                Order #{latestOrder.orderNumber || latestOrder.id}
                              </Link>
                              <p className="text-sm text-gray-500">
                                {new Date(latestOrder.createdAt).toLocaleDateString()} · {latestOrder.items.map((item) => item.product?.title || item.title || 'Artwork').join(', ')}
                              </p>
                            </div>
                            <div className="flex items-center gap-3 sm:text-right">
                              <span className="inline-flex px-2.5 py-1 text-xs font-medium rounded-full bg-surface-muted text-gray-800">
                                {orderStatusLabel(latestOrder.status)}
                              </span>
                              <span className="text-sm font-semibold text-gray-900">{formatPrice(latestOrder.total)}</span>
                            </div>
                          </div>
                        </section>
                      )}

                      <div className="rounded-xl border border-gray-200 p-5 sm:p-6">
                        <h3 className="text-base font-semibold text-gray-900 mb-3">Continue exploring</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <Link href="/shop" className="btn-primary-outline px-4 py-2.5 text-center text-sm">Browse shop</Link>
                          <Link href="/portfolio" className="btn-primary-outline px-4 py-2.5 text-center text-sm">View portfolio</Link>
                          <Link href="/updates" className="btn-primary-outline px-4 py-2.5 text-center text-sm">Studio updates</Link>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <aside className="lg:col-span-1 rounded-xl border border-gray-200/80 bg-surface-muted/60 p-5 sm:p-6">
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <h2 className="text-lg font-semibold text-gray-900">Profile</h2>
                    {!editingProfile ? (
                      <button
                        type="button"
                        onClick={startEditingProfile}
                        className="text-sm font-medium text-primary hover:opacity-80"
                      >
                        Edit
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setEditingProfile(false)}
                        className="text-sm text-gray-500 hover:text-gray-800"
                      >
                        Cancel
                      </button>
                    )}
                  </div>

                  {!editingProfile ? (
                    <dl className="space-y-3 text-sm">
                      <div>
                        <dt className="text-xs font-medium text-gray-500">Name</dt>
                        <dd className="mt-0.5 text-gray-900">{fullName || '-'}</dd>
                      </div>
                      <div>
                        <dt className="text-xs font-medium text-gray-500">Email</dt>
                        <dd className="mt-0.5 text-gray-900 break-all">{profile?.email || session.user?.email}</dd>
                      </div>
                      <div>
                        <dt className="text-xs font-medium text-gray-500">Phone</dt>
                        <dd className="mt-0.5 text-gray-900">{profile?.phone?.trim() || <span className="text-gray-400">Not added</span>}</dd>
                      </div>
                      <div>
                        <dt className="text-xs font-medium text-gray-500">Member since</dt>
                        <dd className="mt-0.5 text-gray-900">{memberSince}</dd>
                      </div>
                      {profileMessage && (
                        <p className={`pt-1 text-sm ${profileMessage.includes('updated') ? 'text-green-700' : 'text-red-700'}`} role="status">
                          {profileMessage}
                        </p>
                      )}
                    </dl>
                  ) : (
                    <form onSubmit={saveProfile} className="space-y-4">
                      <div>
                        <span className="text-xs font-medium text-gray-500">Email</span>
                        <p className="mt-0.5 text-sm text-gray-900 break-all">{profile?.email || session.user?.email}</p>
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
                      {profileMessage && (
                        <p className={`text-sm ${profileMessage.includes('updated') ? 'text-green-700' : 'text-red-700'}`} role="status">
                          {profileMessage}
                        </p>
                      )}
                      <button type="submit" disabled={profileSaving} className="btn-primary w-full px-4 py-2 text-sm disabled:opacity-50">
                        {profileSaving ? 'Saving...' : 'Save Profile'}
                      </button>
                    </form>
                  )}
                </aside>
              </div>
            )}

            {activeTab === 'orders' && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Purchase history</h2>
                {orders.length === 0 ? (
                  <div className="text-center py-10">
                    <h3 className="text-sm font-medium text-gray-900 mb-2">No orders yet</h3>
                    <p className="text-sm text-gray-500 mb-4">When you purchase artwork, your order history will appear here.</p>
                    <Link href="/shop" className="btn-primary px-5 py-2 inline-block text-sm">Browse shop</Link>
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
                            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                              {orderStatusLabel(order.status)}
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
                        <div className="border-t border-gray-200 pt-4 mt-3">
                          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">Fulfillment progress</p>
                          <OrderStatusStepper status={order.status as 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded'} />
                        </div>
                        <OrderMessageComposer
                          orderId={order.id}
                          orderNumber={order.orderNumber || order.id}
                          compact
                          buttonLabel="Message artist about this order"
                        />
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
                    <Link href="/shop" className="btn-primary px-5 py-2 inline-block text-sm">Explore shop</Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {wishlist.map((item) => (
                      <div key={item.id} className="border border-gray-200 rounded-lg overflow-hidden">
                        <Link href={`/shop/${item.productId}`} className="block">
                          <div className="relative aspect-square bg-gray-100">
                            <OptimizedImage
                              src={item.productImage}
                              alt={item.productTitle}
                              variantSize="md"
                              fill
                              className="object-cover"
                              sizes="(max-width: 768px) 100vw, 33vw"
                            />
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

            {activeTab === 'saved' && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Saved updates</h2>
                <SavedUpdatesPanel onCountChange={setSavedCount} />
                <CollectorFeedLink />
              </div>
            )}

            {activeTab === 'recent' && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Recently viewed</h2>
                <RecentlyViewed maxItems={8} showEmptyState showHeading={false} />
              </div>
            )}

            {activeTab === 'messages' && (
              <StudioInboxPanel mode="account" apiBase="/api/account/messages" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
