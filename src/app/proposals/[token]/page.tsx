import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPublicJobByToken } from '@/lib/jobs';
import ProposalPageClient from './ProposalPageClient';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const data = await getPublicJobByToken(token);
  if (!data) {
    return { title: 'Proposal Not Found', robots: { index: false, follow: false } };
  }
  return {
    title: `${data.job.title} | Proposal · ${data.brand.siteName}`,
    description: `Custom commission proposal (${data.job.jobNumber}) from ${data.brand.siteName}.`,
    robots: { index: false, follow: false },
  };
}

export default async function ProposalPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { token } = await params;
  const sp = searchParams ? await searchParams : {};
  const sessionId = typeof sp.session_id === 'string' ? sp.session_id : undefined;
  const paidStage = typeof sp.paid === 'string' ? sp.paid : undefined;
  const cancelled = sp.cancelled === '1';

  const initialData = await getPublicJobByToken(token);
  if (!initialData) {
    notFound();
  }

  return (
    <ProposalPageClient
      token={token}
      initialData={initialData}
      returnSessionId={sessionId}
      returnPaidStage={paidStage}
      returnCancelled={cancelled}
    />
  );
}
