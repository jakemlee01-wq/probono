import { Link, useRoute } from 'wouter';
import { useConfig } from '@/lib/api';

// Policy and support pages. Nothing here is presented as a final legal policy until the owners
// publish one (POLICIES_PUBLISHED on the server). Support appears only once an operator sets SUPPORT_URL.
const PAGES: Record<string, { title: string; body: () => JSX.Element }> = {
  terms: {
    title: 'Terms of use',
    body: () => (
      <>
        <Status />
        <p>probono is a small, closed pilot. Terms of use are being drafted for the owners to review and are not in effect yet.</p>
        <p>Until then: volunteering through probono is unpaid, does not create a professional engagement, and does not authorize regulated work such as signing tax returns or audit opinions.</p>
      </>
    ),
  },
  privacy: {
    title: 'Privacy',
    body: () => (
      <>
        <Status />
        <p>A privacy policy hasn't been published yet. This is a plain description of what the app stores today. It describes the software, not a legal commitment.</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Your email address and password, handled by Supabase Auth.</li>
          <li>Your profile or organization profile, postings, and photos. Profiles and photos you add can be seen by people in the pilot who fit your terms. Photo files are stored at public web addresses.</li>
          <li>Interest messages, work agreements, acceptances with their times, chat messages, hours, check-ins, and links for projects you're part of. Only the two sides of a project can see it.</li>
          <li>In-app notifications, blocks, and reports. Reports are visible only to the pilot team.</li>
          <li>Short-lived counters used for rate limits, keyed by account id or a one-way hash of your network address.</li>
        </ul>
        <p>The website is hosted on GitHub Pages, and its font loads from Google Fonts. Data is stored with Supabase. There is no advertising or analytics tracking.</p>
        <p>The demo stores its fictional data only in your own browser.</p>
        <p>You can delete your account in Profile, Account. What is kept afterward is listed there.</p>
      </>
    ),
  },
  community: {
    title: 'Community guidelines',
    body: () => (
      <>
        <p className="rounded-2xl bg-apricot/25 p-3">Pilot guidelines. The owners haven't finalized these yet.</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Be respectful and honest about your skills and availability.</li>
          <li>Stick to the work agreement. Propose changes in the app so both sides accept them.</li>
          <li>Never ask for or share passwords, bank details, or full account numbers in chat.</li>
          <li>Ask for only the access the work needs, with a named account. Remove access when the project ends.</li>
          <li>Don't offer or ask for regulated services such as tax filing or audit opinions.</li>
          <li>Use Report or block if something feels wrong. You can stop a project at any time.</li>
        </ul>
      </>
    ),
  },
  support: {
    title: 'Support',
    body: () => <Support />,
  },
};

function Status() {
  const cfg = useConfig();
  return cfg.data?.policiesPublished ? null : <p className="rounded-2xl bg-apricot/25 p-3">Not yet published. This page will hold the final version once the owners approve it.</p>;
}
function Support() {
  const cfg = useConfig();
  const url = cfg.data?.supportUrl;
  return url ? (
    <p>Questions or problems? <a className="underline underline-offset-4" href={url} rel="noreferrer noopener">Contact the probono pilot team</a>. There's no guaranteed response time during the pilot.</p>
  ) : (
    <>
      <p>A support contact hasn't been set up yet.</p>
      <p>In the meantime, use Report or block on a profile or project for safety problems. Reports are saved privately for the pilot team.</p>
    </>
  );
}

export default function InfoPage() {
  const [, params] = useRoute('/about/:page');
  const page = PAGES[params?.page ?? ''];
  return (
    <div className="min-h-[100dvh] bg-cream px-5 py-8 text-plum">
      <main className="mx-auto max-w-lg">
        <Link href="/" className="font-serif text-3xl">probono</Link>
        <h1 className="mt-8 font-serif text-5xl leading-[1.05]">{page?.title ?? 'Not found'}</h1>
        <div className="mt-6 space-y-4 text-sm leading-relaxed">{page ? <page.body /> : <p>That page doesn't exist.</p>}</div>
        <Footer />
      </main>
    </div>
  );
}

export function Footer({ dark }: { dark?: boolean }) {
  return (
    <footer className={`mt-10 border-t pt-4 text-xs ${dark ? 'border-cream/20 text-cream/75' : 'border-plum/15 text-plum/70'}`}>
      <nav aria-label="Policies and help" className="flex flex-wrap gap-x-4">
        {[['terms', 'Terms'], ['privacy', 'Privacy'], ['community', 'Community guidelines'], ['support', 'Support']].map(([k, l]) => (
          <Link key={k} href={`/about/${k}`} className="min-h-11 py-3 underline underline-offset-4">{l}</Link>
        ))}
      </nav>
    </footer>
  );
}
