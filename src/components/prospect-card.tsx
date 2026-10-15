import type { Profile, Prospect, Terms } from '@shared/types';
import { optionLabel } from '@shared/rules';
import { Tile } from './bits';
import { SafetyButton } from './safety';
import { badgeText, fmtDate, photoUrl } from '@/lib/util';

export function termsLine(t: Terms) {
  return `${t.hoursPerWeek} hrs/wk · ${t.weeks} wks · ${t.format}`;
}

export function trackLine(p: Profile): string {
  const r = p.record ?? { completedProjects: 0, hoursSelfReported: 0, hoursConfirmed: 0 };
  const projects = `${r.completedProjects} completed project${r.completedProjects === 1 ? '' : 's'} on probono`;
  if (p.kind === 'nonprofit') return `${p.foundedYear ? `Running since ${p.foundedYear}` : 'Founding year not provided'} · ${projects}`;
  const years = p.years === null || p.years === undefined ? 'Experience not provided' : `${p.years} yrs experience`;
  const hours = r.hoursSelfReported ? ` · ${r.hoursSelfReported} hrs logged (${r.hoursConfirmed} confirmed by nonprofits)` : '';
  return `${years} · ${projects}${hours}`;
}

// What a badge means, in plain words. An invite is not a credential check.
export function Badges({ profile, dark }: { profile: Profile; dark?: boolean }) {
  const items: string[] = (profile.reviews ?? []).map((b) => `${badgeText(b)}${b.demo ? ' (demo record)' : ''}`);
  if (profile.kind === 'volunteer') {
    if (!profile.reviews?.some((b) => b.kind === 'identity')) items.push('Joined by pilot invite · identity not reviewed');
    if (profile.credential && !profile.reviews?.some((b) => b.kind === 'credential' && b.status === 'reviewed')) items.push(`${profile.credential}: self-reported, not verified`);
  }
  if (!items.length) return null;
  return (
    <ul className="mt-2 flex flex-wrap gap-1.5">
      {items.map((t) => <li key={t} className={`rounded-full border px-2.5 py-1 text-[11px] ${dark ? 'border-white/25 text-white/80' : 'border-plum/20 text-plum/75'}`}>{t}</li>)}
    </ul>
  );
}

// One prospect at a time. The facts needed to decide come first; photos and background are secondary.
export function ProspectCard({ prospect, viewer, preview, readOnly }: { prospect: Prospect; viewer: 'volunteer' | 'nonprofit'; preview?: boolean; readOnly?: string }) {
  const { profile, posting } = prospect;
  const fromPosting = viewer === 'volunteer';
  const t = fromPosting ? posting.terms : profile.terms;
  const skills = (fromPosting ? posting.skills : profile.skills).map(optionLabel);
  const time = fromPosting
    ? [`${t.hoursPerWeek} hrs a week`, `${t.weeks} weeks`, t.format, `Proposed start ${fmtDate(t.startDate, 'MMM d')}`]
    : [`Up to ${t.hoursPerWeek} hrs a week`, t.minWeeks === t.maxWeeks ? `${t.minWeeks} weeks` : `${t.minWeeks} to ${t.maxWeeks} weeks`, t.format, `Free from ${fmtDate(t.startDate, 'MMM d')}`];
  const pr = fromPosting && posting.prompts.first ? posting.prompts : profile.prompts;
  const facts: [string, string][] = fromPosting
    ? [['Why it matters', posting.prompts.second], ['What gets handed over', posting.prompts.third]]
    : [["Best at", profile.prompts.first]];
  const more: [string, string][] = fromPosting
    ? [['What they do', pr.first]]
    : [['Causes close to them', profile.prompts.second], ['Working with them looks like', profile.prompts.third]];
  const photo = profile.photos[0];
  const box = 'rounded-[2rem] bg-plum2 p-4 text-white';
  return (
    <article aria-label={fromPosting ? `${posting.title}, ${profile.name}` : profile.name} className={box}>
      <header>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-white/75">{fromPosting ? profile.name : 'Volunteer'}</p>
          {prospect.interestedInYou && <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-bold text-plum">Interested in you</span>}
          {readOnly && <span className="rounded-full border border-white/40 px-2.5 py-0.5 text-xs">Browsing only</span>}
        </div>
        <h2 className="mt-1 font-serif text-[2rem] leading-[1.05]">{fromPosting ? posting.title : profile.name}</h2>
        {!fromPosting && profile.title && <p className="mt-1 text-sm text-white/90">{profile.title}</p>}
      </header>
      <dl className="mt-3 space-y-3">
        {facts.filter(([, v]) => v).map(([k, v]) => (
          <div key={k}><dt className="text-[11px] font-bold uppercase tracking-[0.15em] text-white/65">{k}</dt><dd className="mt-0.5 text-[15px] leading-snug">{v}</dd></div>
        ))}
      </dl>
      <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Skills and time">
        {[...skills, ...time].map((c) => <li key={c} className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-plum">{c}</li>)}
      </ul>
      {!fromPosting && <p className="mt-3 text-xs text-white/75">{trackLine(profile)}</p>}
      <Badges profile={profile} dark />
      {prospect.interestedInYou && prospect.note && (
        <div className="mt-3 rounded-2xl bg-white/10 p-3">
          <p className="text-xs font-semibold text-white/75">Their message</p>
          <p className="mt-1 whitespace-pre-wrap font-serif text-lg italic leading-snug">"{prospect.note}"</p>
        </div>
      )}
      {photo && (
        <figure className="mt-3">
          <Tile name={profile.name} alt={`Photo from ${profile.name}${profile.fictional ? ' (fictional, AI-generated)' : ''}`} src={photoUrl(photo)} className="h-36 w-full rounded-2xl" />
          {profile.fictional && <figcaption className="mt-1 text-[11px] text-white/65">Fictional · AI-generated photo</figcaption>}
        </figure>
      )}
      <details className="mt-3 rounded-2xl border border-white/15 px-3">
        <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">Show details about {profile.name}</summary>
        <div className="space-y-3 pb-3 text-sm">
          {more.filter(([, v]) => v).map(([k, v]) => <p key={k}><b className="block text-[11px] uppercase tracking-[0.15em] text-white/65">{k}</b>{v}</p>)}
          {fromPosting && <p className="text-xs text-white/75">{trackLine(profile)}</p>}
          {(profile.quotes?.length ?? 0) > 0 && (
            <div>
              <p className="text-xs font-semibold">{fromPosting ? 'From volunteers who worked with them' : 'From nonprofits they worked with'}</p>
              {profile.quotes!.map((q, j) => (
                <blockquote key={j} className="mt-2">“{q.text}”<cite className="mt-1 block text-xs not-italic text-white/60">{q.author}, {q.projectTitle}{q.fictional ? ' · fictional demo quote' : ''}</cite></blockquote>
              ))}
            </div>
          )}
          {profile.photos.length > 1 && (
            <div className="flex gap-2">{profile.photos.slice(1, 4).map((ph) => <Tile key={ph} name={profile.name} alt={`Photo from ${profile.name}`} src={photoUrl(ph)} className="h-24 w-24 rounded-xl" />)}</div>
          )}
        </div>
      </details>
      {!preview && (
        <div className="pt-1 text-right">
          <SafetyButton tone="dark" targetId={profile.id} targetName={profile.name} postingId={posting.id} />
        </div>
      )}
    </article>
  );
}
