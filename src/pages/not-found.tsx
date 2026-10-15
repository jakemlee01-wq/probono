import { Link } from 'wouter';

export default function NotFound() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-plum p-6 text-center text-cream">
      <h1 className="font-serif text-4xl">Nothing here</h1>
      <Link href="/" className="min-h-11 rounded-full bg-cream px-5 py-3 text-sm font-semibold text-plum">Back to probono</Link>
    </div>
  );
}
