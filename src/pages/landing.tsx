import { Link } from 'wouter';
import { DemoEntry } from '@/components/demo';
import { Footer } from './info';

// One job: say what probono is, and let people try it. Membership is secondary.
export default function Landing() {
  return (
    <div className="grain relative min-h-[100dvh] bg-plum text-cream">
      <div className="relative z-10 mx-auto w-full max-w-md px-5 pb-8">
        <header className="flex items-center justify-between pt-4">
          <span className="font-serif text-3xl">probono</span>
          <Link href="/sign-in" className="min-h-11 px-2 py-3 text-sm font-semibold underline underline-offset-4">Sign in</Link>
        </header>
        <main>
          <section className="pt-4">
            <figure className="relative">
              <img src={`${import.meta.env.BASE_URL}assets/demo-photos/northside-team.jpg`} width={825} height={1024} alt="A small nonprofit team working around a table (fictional, AI-generated)"
                className="h-[clamp(8rem,24dvh,16rem)] w-full rounded-3xl bg-plum2 object-cover" />
              <figcaption className="absolute bottom-2 left-2 rounded-full bg-plum/80 px-2.5 py-1 text-[11px]">Fictional · AI-generated photo</figcaption>
            </figure>
            <h1 className="mt-5 font-serif text-[1.85rem] leading-[1.12] min-[380px]:text-[2.1rem]">
              probono matches Twin Cities nonprofits with accounting and finance volunteers for small, unpaid projects.
            </h1>
            <div className="mt-6"><DemoEntry /></div>
            <p className="mt-2 text-center text-sm text-cream/80">No account needed. Fictional people and projects.</p>
          </section>

          <section aria-label="How it works" className="mt-10">
            <p className="font-serif text-2xl">Find a project. Agree the work. Help a nonprofit finish it.</p>
            <article className="mt-4 rounded-3xl bg-plum2 p-5 text-sm">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-cream/70">Example project · fictional</p>
              <h2 className="mt-1 font-serif text-2xl">A simple annual budget template</h2>
              <p className="text-cream/80">Eastside Food Shelf · 3 hours a week for 4 weeks · remote</p>
              <dl className="mt-3 space-y-2">
                <div><dt className="font-semibold">Handed over</dt><dd className="text-cream/85">A one-page budget template with last year's spending filled in, and a 30-minute walkthrough.</dd></div>
                <div><dt className="font-semibold">Done when</dt><dd className="text-cream/85">The director updates it for next quarter without help.</dd></div>
              </dl>
            </article>
          </section>

          <section aria-labelledby="pilot-access" className="mt-10 rounded-3xl border border-cream/20 p-5 text-sm">
            <h2 id="pilot-access" className="font-serif text-2xl">Pilot access</h2>
            <p className="mt-1 text-cream/80">probono is a small pilot. Accounts are for people already taking part.</p>
            <ul className="mt-3 divide-y divide-cream/15">
              <li><Link href="/sign-in" className="flex min-h-12 items-center justify-between">Already a member<span className="underline underline-offset-4">Sign in</span></Link></li>
              <li><Link href="/join/volunteer" className="flex min-h-12 items-center justify-between">Volunteer with an invite<span className="underline underline-offset-4">Use your invite</span></Link></li>
              <li><Link href="/join/nonprofit" className="flex min-h-12 items-center justify-between">Nonprofit<span className="underline underline-offset-4">Nonprofit access</span></Link></li>
            </ul>
          </section>
        </main>
        <Footer dark />
      </div>
    </div>
  );
}
