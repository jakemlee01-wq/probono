import { Link } from 'wouter';
import { DemoLink } from '@/components/demo';

// The front door does one job: get people in. Everything else lives after sign-in.
export default function Landing() {
  return (
    <div className="grain relative flex min-h-[100dvh] flex-col bg-plum text-cream">
      <main className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col px-5 pb-8 pt-6">
        <span className="font-serif text-3xl">probono</span>
        <div className="rise mt-5 overflow-hidden rounded-[2rem] bg-plum2 p-2.5">
          <img src={`${import.meta.env.BASE_URL}assets/demo-photos/sally-2.jpg`} alt="" className="aspect-[4/5] max-h-[38dvh] w-full rounded-3xl object-cover" />
        </div>
        <h1 className="rise mt-6 font-serif text-[2.3rem] leading-[1.08]" style={{ animationDelay: '.08s' }}>
          Lend your skills to a Twin Cities nonprofit, a few hours at a time.
        </h1>
        <div className="mt-auto space-y-3 pt-6">
          <Link href="/sign-in" className="flex min-h-12 w-full items-center justify-center rounded-full bg-cream px-6 font-semibold text-plum">Sign in</Link>
          <Link href="/sign-up" className="flex min-h-12 w-full items-center justify-center rounded-full border border-cream/40 px-6 font-semibold">I have an invite</Link>
          <div className="flex items-center justify-between pt-1 text-cream/75">
            <Link href="/sign-up" className="min-h-11 py-3 text-sm underline underline-offset-4">Nonprofit? Get started</Link>
            <DemoLink />
          </div>
        </div>
      </main>
    </div>
  );
}
