import { Link } from 'wouter';
import { DemoEntry } from '@/components/demo';
import { Footer } from './info';

// One line, one button. Everything else is a small link.
export default function Landing() {
  const link = 'min-h-11 py-3 underline underline-offset-4';
  return (
    <div className="grain relative min-h-[100dvh] bg-plum text-cream">
      <div className="relative z-10 mx-auto w-full max-w-md px-5 pb-8">
        <header className="pt-4"><span className="font-serif text-3xl">probono</span></header>
        <main className="pt-4">
          <figure className="relative">
            <img src={`${import.meta.env.BASE_URL}assets/demo-photos/northside-team.jpg`} width={825} height={1024} alt="A small nonprofit team working around a table (fictional, AI-generated)"
              className="h-[clamp(7rem,22dvh,17rem)] w-full rounded-3xl bg-plum2 object-cover" />
            <figcaption className="absolute bottom-2 left-2 rounded-full bg-plum/80 px-2.5 py-1 text-[11px]">Fictional · AI-generated photo</figcaption>
          </figure>
          <h1 className="mt-5 font-serif text-[1.7rem] leading-[1.15] min-[380px]:text-[2rem]">
            Small accounting and finance projects for Twin Cities nonprofits, done by volunteers a few hours at a time.
          </h1>
          <div className="mt-6"><DemoEntry /></div>
          <p className="mt-2 text-center text-sm text-cream/80">No account needed. Fictional people and projects.</p>
          <nav aria-label="Pilot access" className="mt-2 flex flex-wrap items-center justify-center gap-x-3 text-sm text-cream/85">
            <Link href="/sign-in" className={link}>Sign in</Link>
            <Link href="/join/volunteer" className={link}>Have an invite?</Link>
            <Link href="/join/nonprofit" className={link}>Nonprofits</Link>
          </nav>
        </main>
        <Footer dark />
      </div>
    </div>
  );
}
