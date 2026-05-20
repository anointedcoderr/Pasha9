import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/site/Logo';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <Logo />
      <p className="mt-6 text-7xl font-extrabold text-gradient-gold">404</p>
      <h1 className="mt-2 text-2xl font-bold text-ink-hi">Page not found</h1>
      <p className="mt-2 max-w-md text-sm text-ink-mid">The address you opened does not match any page on this platform. It may have moved or been removed.</p>
      <div className="mt-6 flex gap-2">
        <Link href="/"><Button>Back to Home</Button></Link>
        <Link href="/support"><Button variant="neon">Contact Support</Button></Link>
      </div>
    </div>
  );
}
