import type { Metadata } from 'next';
import SignInForm from './SignInForm';
import { isGoogleAuthEnabled } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'Sign In',
};

function firstQueryValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string | string[]; error?: string | string[] }>;
}) {
  const params = await searchParams;

  return (
    <SignInForm
      callbackUrlParam={firstQueryValue(params.callbackUrl)}
      errorParam={firstQueryValue(params.error)}
      googleEnabled={isGoogleAuthEnabled()}
    />
  );
}
