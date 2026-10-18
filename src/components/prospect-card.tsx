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

// One prospect at a time: photo first, then the title and the fit at a glance. The rest is in Show details.
export function ProspectCard({ prospect, viewer, preview, readOnly }: { prospect: Prospect; viewer: 'volunteer' | 'nonprofit'; preview?: boolean; readOnly?: string }) {
  const { profile, posting } = prospect;
  const fromPosting = viewer === 'volunteer';
  const t = fromPosting ? posting.terms : profile.terms;
  const skills = (fromPosting ? posting.skills : profile.skills).map(optionLabel);
  const chips = fromPosting
    ? [...skills, `${t.hoursPerWeek} hrs/wk · ${t.weeks} wks · ${t.format}`]
    : [...skills, `Up to ${t.hoursPerWeek} hrs/wk · ${t.minWeeks === t.maxWeeks ? t.minWeeks : `${t.minWeeks}-${t.maxWeeks}`} wks · ${t.format}`];
  const pr = fromPosting && posting.prompts.first ? posting.prompts : profile.prompts;
  const details: [string, string][] = fromPosting
    ? [['Why it matters', posting.prompts.second], ['What gets handed over', posting.prompts.third], ['Proposed start', fmtDate(t.startDate)], ['What they do', pr.first]]
    : [['Best at', profile.prompts.first], ['Free from', fmtDate(t.startDate)], ['Causes close to them', profile.prompts.second], ['Working with them looks like', profile.prompts.third]];
  const photo = profile.photos[0];
  return (
    <article aria-label={fromPosting ? `${posting.title}, ${profile.name}` : profile.name} className="overflow-hidden rounded-[2rem] bg-plum2 text-white">
      {/* On short screens (landscape phones, 200% zoom) the photo sits beside the title instead of above it. */}
      <div className="[@media(max-height:500px)]:flex">
        <div className="relative [@media(max-height:500px)]:w-2/5 [@media(max-height:500px)]:shrink-0">
          <Tile name={profile.name} alt={`Photo from ${profile.name}${profile.fictional ? ' (fictional, AI-generated)' : ''}`} src={photo ? photoUrl(photo) : undefined}
            className="aspect-[4/5] max-h-[max(7.5rem,calc(100dvh-28.5rem))] w-full text-7xl md:max-h-[max(7.5rem,min(32rem,calc(100dvh-26rem)))] [@media(max-height:500px)]:aspect-auto [@media(max-height:500px)]:h-full [@media(max-height:500px)]:max-h-none" />
          <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
            {prospect.interestedInYou && <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-plum">Interested in you</span>}
            {readOnly && <span className="rounded-full bg-plum/80 px-2.5 py-1 text-xs">Browsing only</span>}
          </div>
          {profile.fictional && photo && <span className="absolute bottom-2 left-2 rounded-full bg-plum/80 px-2.5 py-1 text-[11px]">Fictional · AI-generated photo</span>}
        </div>
        <div className="px-4 pt-3">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-white/75">{fromPosting ? profile.name : profile.title || 'Volunteer'}</p>
          <h2 className="mt-0.5 font-serif text-[1.6rem] leading-[1.05] min-[380px]:text-[1.9rem]">{fromPosting ? posting.title : profile.name}</h2>
          <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Skills and time">
            {chips.map((c) => <li key={c} className="rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-plum min-[380px]:px-2.5 min-[380px]:text-xs">{c}</li>)}
          </ul>
        </div>
      </div>
      <div className="px-4 pb-4">
        {prospect.interestedInYou && prospect.note && (
          <p className="mt-3 whitespace-pre-wrap border-l-2 border-apricot pl-3 font-serif text-lg italic leading-snug text-white/90">"{prospect.note}"</p>
        )}
        <details className="mt-3 rounded-2xl border border-white/15 px-3">
          <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">Show details</summary>
          <div className="space-y-3 pb-3 text-sm">
            {details.filter(([, v]) => v).map(([k, v]) => <p key={k}><b className="block text-[11px] uppercase tracking-[0.15em] text-white/65">{k}</b>{v}</p>)}
            <p className="text-xs text-white/75">{trackLine(profile)}</p>
            <Badges profile={profile} dark />
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
      </div>
    </article>
  );
}
