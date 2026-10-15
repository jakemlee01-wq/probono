import { Link } from 'wouter';
import { DemoLink } from '@/components/demo';
import { Footer } from './info';

// The first screen gets people in. The sections below explain the pilot honestly.
export default function Landing() {
  const steps = ['Create a profile or a posting.', 'Show interest. When it\'s mutual, you have 72 hours to decide.', 'Agree a one-page work agreement: deliverables, scope, access, check-ins.', 'Both sides accept the same version.', 'Work together for a few hours a week.', 'Close it out with a note from each side.'];
  return (
    <div className="grain relative min-h-[100dvh] bg-plum text-cream">
      <main className="relative z-10 mx-auto w-full max-w-md px-5 pb-8 pt-6">
        <div className="flex min-h-[calc(100dvh-3.5rem)] flex-col">
          <span className="font-serif text-3xl">probono</span>
          <figure className="mt-5 rounded-[2rem] bg-plum2 p-2.5">
            <img src={`${import.meta.env.BASE_URL}assets/demo-photos/sally-2.jpg`} width={800} height={1000} alt="A fictional demo volunteer"
              className="aspect-[4/5] max-h-[34dvh] w-full rounded-3xl bg-plum3 object-cover" />
            <figcaption className="px-2 pt-1.5 text-[11px] text-cream/65">Fictional demo profile. AI-generated photo.</figcaption>
          </figure>
          <h1 className="mt-5 font-serif text-[2.2rem] leading-[1.08]">Lend your skills to a Twin Cities nonprofit, a few hours at a time.</h1>
          <p className="mt-2 text-sm text-cream/80">An early pilot, starting with accounting and finance volunteers.</p>
          <div className="mt-auto space-y-3 pt-6">
            <Link href="/sign-in" className="flex min-h-12 w-full items-center justify-center rounded-full bg-cream px-6 font-semibold text-plum">Sign in</Link>
            <Link href="/join/volunteer" className="flex min-h-12 w-full items-center justify-center rounded-full border border-cream/45 px-6 font-semibold">Join with an invite</Link>
            <div className="flex items-center justify-between pt-1 text-cream/80">
              <Link href="/join/nonprofit" className="min-h-11 py-3 text-sm underline underline-offset-4">Create a nonprofit account</Link>
              <DemoLink />
            </div>
            <a href="#about" onClick={(e) => { e.preventDefault(); document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' }); }} className="block min-h-11 py-3 text-center text-xs text-cream/70 underline underline-offset-4">How the pilot works</a>
          </div>
        </div>

        <div id="about" className="space-y-10 pt-12 text-sm leading-relaxed text-cream/85">
          <section>
            <h2 className="font-serif text-3xl text-cream">Who it's for</h2>
            <p className="mt-2">Nonprofits in Minneapolis, St. Paul, and nearby, and volunteers with accounting and finance experience: budgets, reporting, month-end close, accounting systems, grant tracking, internal controls. Other kinds of skills aren't part of this pilot yet.</p>
          </section>
          <section>
            <h2 className="font-serif text-3xl text-cream">How it works</h2>
            <ol className="mt-2 list-decimal space-y-1 pl-5">{steps.map((s) => <li key={s}>{s}</li>)}</ol>
          </section>
          <section className="rounded-3xl bg-plum2 p-5">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-cream/65">Example project (fictional)</p>
            <h3 className="mt-1 font-serif text-2xl text-cream">Month-end reporting cleanup</h3>
            <dl className="mt-3 space-y-2">
              <div><dt className="font-semibold text-cream">Deliverables</dt><dd>Three monthly report templates and a one-page guide for the finance team.</dd></div>
              <div><dt className="font-semibold text-cream">Time</dt><dd>5 hours a week for 5 weeks, remote.</dd></div>
              <div><dt className="font-semibold text-cream">Access</dt><dd>No system access. The volunteer works from exports the team sends.</dd></div>
              <div><dt className="font-semibold text-cream">Done when</dt><dd>The team runs one month-end's reports on their own.</dd></div>
            </dl>
          </section>
          <section>
            <h2 className="font-serif text-3xl text-cream">What review means</h2>
            <p className="mt-2">Volunteers join by personal invitation from the people running the pilot. An invite is not a check of anyone's credentials. Credentials on profiles are self-reported unless a badge says exactly what was reviewed.</p>
            <p className="mt-2">Nonprofits register freely. The pilot team reviews each organization by hand before volunteers can see its postings.</p>
            <p className="mt-2">probono doesn't guarantee the quality of anyone's work, and volunteering here doesn't create a professional engagement. Either side can stop a project or report a problem at any time.</p>
          </section>
          <section>
            <h2 className="font-serif text-3xl text-cream">Joining</h2>
            <p className="mt-2">Volunteers: use the invite code you were given. There's no public waitlist yet. Nonprofits: create an account, write a posting, and wait for review.</p>
          </section>
          <section>
            <h2 className="font-serif text-3xl text-cream">Results so far</h2>
            <p className="mt-2">This is an early pilot, so there are no results to share yet. Everyone in the demo is fictional.</p>
          </section>
        </div>
        <Footer dark />
      </main>
    </div>
  );
}
