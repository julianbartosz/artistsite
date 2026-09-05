import SignInForm from './SignInForm';

function firstQueryValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string | string[] }>;
}) {
  const params = await searchParams;

  return <SignInForm callbackUrlParam={firstQueryValue(params.callbackUrl)} />;
}
