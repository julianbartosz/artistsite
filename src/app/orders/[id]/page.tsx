import { Metadata } from 'next';
import OrderTracking from '@/components/OrderTracking';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Order Status - Artist Site',
  robots: { index: false, follow: false },
};

export default async function OrderStatusPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ t?: string | string[] }>;
}) {
  const { id } = await params;
  const { t } = await searchParams;
  const accessToken = Array.isArray(t) ? t[0] : t;

  return (
    <main className="min-h-screen bg-gray-50 py-12">
      <OrderTracking orderId={id} accessToken={accessToken} />
    </main>
  );
}