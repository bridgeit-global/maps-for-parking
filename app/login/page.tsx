import type { Metadata } from 'next';
import LoginForm from './LoginForm';

export const metadata: Metadata = {
  title: 'Sign in | Maps for Parking',
  description: 'Email a magic link to check parking rules and report towing hotspots.'
};

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ next?: string; reason?: string; error?: string }>;
}) {
  const params = await searchParams;
  return (
    <div className="min-h-screen bg-[#0b1118] text-white">
      <LoginForm nextPath={params.next ?? '/'} reason={params.reason} error={params.error} />
    </div>
  );
}
