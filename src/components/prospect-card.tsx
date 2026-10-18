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

// One prospect at a time: photo, title, fit chips, and the outcome in a line. Nothing to expand.
export function ProspectCard({ prospect, viewer, preview, readOnly }: { prospect: Prospect; viewer: 'volunteer' | 'nonprofit'; preview?: boolean; readOnly?: string }) {
  const { profile, posting } = prospect;
  const fromPosting = viewer === 'volunteer';
  const t = fromPosting ? posting.terms : profile.terms;
  const skills = (fromPosting ? posting.skills : profile.skills).map(optionLabel);
  const credentialReviewed = profile.reviews?.some((b) => b.kind === 'credential' && b.status === 'reviewed');
  const chips = fromPosting
    ? [...skills, `${t.hoursPerWeek} hrs/wk · ${t.weeks} wks · ${t.format}`]
    : [...skills, `Up to ${t.hoursPerWeek} hrs/wk · ${t.minWeeks === t.maxWeeks ? t.minWeeks : `${t.minWeeks}-${t.maxWeeks}`} wks · ${t.format}`,
      ...(profile.credential ? [`${profile.credential}${credentialReviewed ? ', reviewed' : ', self-reported'}`] : [])];
  // The outcome in one line, and how everyone will know it's done.
  const outcome = fromPosting ? posting.prompts.third : profile.prompts.first;
  const doneWhen = fromPosting ? posting.doneWhen : '';
  const photo = profile.photos[0];
  const badge = fromPosting ? 'Nonprofit wants you' : 'Wants to help you';
  return (
    <article aria-label={fromPosting ? `${posting.title}, ${profile.name}` : profile.name} className="overflow-hidden rounded-[2rem] bg-plum2 text-white">
      {/* On short screens (landscape phones, 200% zoom) the photo sits beside the text instead of above it. */}
      <div className="[@media(max-height:500px)]:flex">
        <div className="relative [@media(max-height:500px)]:w-2/5 [@media(max-height:500px)]:shrink-0">
          <Tile name={profile.name} alt={`Photo from ${profile.name}${profile.fictional ? ' (fictional, AI-generated)' : ''}`} src={photo ? photoUrl(photo) : undefined}
            className="aspect-[4/5] max-h-[max(6.5rem,calc(100dvh-34rem))] w-full text-7xl md:max-h-[max(6.5rem,min(30rem,calc(100dvh-32rem)))] [@media(max-height:500px)]:aspect-auto [@media(max-height:500px)]:h-full [@media(max-height:500px)]:max-h-none" />
          <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
            {prospect.interestedInYou && <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-plum">{badge}</span>}
            {readOnly && <span className="rounded-full bg-plum/80 px-2.5 py-1 text-xs">Browsing only</span>}
          </div>
          {profile.fictional && photo && <span className="absolute bottom-2 left-2 rounded-full bg-plum/80 px-2.5 py-1 text-[11px]">Fictional · AI-generated photo</span>}
        </div>
        <div className="px-4 pb-3 pt-3">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-white/75">{fromPosting ? profile.name : profile.title || 'Volunteer'}</p>
          <h2 className="mt-0.5 font-serif text-[1.6rem] leading-[1.05] min-[380px]:text-[1.9rem]">{fromPosting ? posting.title : profile.name}</h2>
          <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Skills and time">
            {chips.map((c) => <li key={c} className="rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-plum min-[380px]:px-2.5 min-[380px]:text-xs">{c}</li>)}
          </ul>
          {outcome && <p className="mt-2 line-clamp-2 text-sm leading-snug text-white/90">{outcome}</p>}
          {doneWhen && <p className="mt-1 line-clamp-2 text-sm leading-snug text-white/90"><b>Done when:</b> {doneWhen}</p>}
          {!preview && (
            <div className="text-right">
              <SafetyButton tone="dark" targetId={profile.id} targetName={profile.name} postingId={posting.id} />
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
