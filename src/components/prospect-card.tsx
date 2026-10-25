import { useRef, useState } from 'react';
import type { Profile, Prospect, Terms } from '@shared/types';
import { optionLabel } from '@shared/rules';
import { Tile } from './bits';
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
  const badge = fromPosting ? 'Nonprofit wants you' : 'Wants to help you';
  const eyebrow = fromPosting ? profile.name : profile.title || 'Volunteer';
  const title = fromPosting ? posting.title : profile.name;
  return (
    <article aria-label={fromPosting ? `${posting.title}, ${profile.name}` : profile.name} className="overflow-hidden rounded-[2rem] bg-plum2 text-white">
      {/* On short screens (landscape phones, 200% zoom) the photo sits beside the text instead of above it. */}
      <div className="[@media(max-height:500px)]:flex">
        <div className="relative [@media(max-height:500px)]:w-2/5 [@media(max-height:500px)]:shrink-0">
          <Photos profile={profile} />
          <div className="pointer-events-none absolute left-3 top-6 flex flex-wrap gap-1.5">
            {prospect.interestedInYou && !fromPosting && <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-plum">{badge}</span>}
            {readOnly && <span className="rounded-full bg-plum/80 px-2.5 py-1 text-xs">Browsing only</span>}
          </div>
          {/* The title sits on the photo, over a plum fade, so the photo can be big. */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-plum2 via-plum2/70 to-transparent px-4 pb-3 pt-14 [@media(max-height:500px)]:hidden">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-white/85">{eyebrow}</p>
            <h2 className="mt-0.5 font-serif text-[1.6rem] leading-[1.05] min-[380px]:text-[1.9rem]">{title}</h2>
          </div>
        </div>
        <div className="px-4 pb-3 pt-2.5">
          <div className="hidden [@media(max-height:500px)]:block">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-white/75">{eyebrow}</p>
            <h2 className="mt-0.5 mb-2 font-serif text-[1.6rem] leading-[1.05]">{title}</h2>
          </div>
          <ul className="flex flex-wrap gap-1.5" aria-label="Skills and time">
            {chips.map((c) => <li key={c} className="rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-plum min-[380px]:px-2.5 min-[380px]:text-xs">{c}</li>)}
          </ul>
          {outcome && <p className="mt-2 line-clamp-2 text-sm leading-snug text-white/90">{outcome}</p>}
          {doneWhen && <p className="mt-1 line-clamp-2 text-sm leading-snug text-white/90"><b>Done when:</b> {doneWhen}</p>}
        </div>
      </div>
    </article>
  );
}

// Every photo on the profile: swipe, tap the left or right side, or use the arrow keys. Bars show where you are.
function Photos({ profile }: { profile: Profile }) {
  const photos = profile.photos.length ? profile.photos : [''];
  const [i, setI] = useState(0);
  const start = useRef<{ x: number; y: number } | null>(null);
  const n = photos.length;
  const go = (d: number) => setI((v) => Math.min(n - 1, Math.max(0, v + d)));
  const label = (k: number) => `Photo from ${profile.name}${profile.fictional ? ' (fictional, AI-generated)' : ''}${n > 1 ? `, ${k + 1} of ${n}` : ''}`;
  return (
    <div
      className="relative h-[clamp(9rem,calc(100dvh-26rem),52dvh)] w-full touch-pan-y select-none [@media(max-height:500px)]:h-full [@media(max-height:500px)]:min-h-40"
      role={n > 1 ? 'group' : undefined}
      aria-roledescription={n > 1 ? 'carousel' : undefined}
      aria-label={n > 1 ? `Photos from ${profile.name}` : undefined}
      tabIndex={n > 1 ? 0 : undefined}
      onKeyDown={(e) => { if (e.key === 'ArrowRight') { e.preventDefault(); go(1); } if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); } }}
      onPointerDown={(e) => { start.current = { x: e.clientX, y: e.clientY }; }}
      onPointerUp={(e) => {
        const s = start.current; start.current = null;
        if (!s || n < 2) return;
        const dx = e.clientX - s.x, dy = e.clientY - s.y;
        if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) return go(dx < 0 ? 1 : -1);
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
          const r = e.currentTarget.getBoundingClientRect();
          go(e.clientX - r.left < r.width / 2 ? -1 : 1);
        }
      }}
    >
      <Tile key={photos[i]} name={profile.name} alt={label(i)} src={photos[i] ? photoUrl(photos[i]) : undefined}
        className="h-full w-full text-7xl" />
      {n > 1 && (
        <div aria-hidden className="pointer-events-none absolute inset-x-3 top-2.5 flex gap-1">
          {photos.map((_, k) => <span key={k} data-active={k === i || undefined} className={`h-[3px] flex-1 rounded-full ${k === i ? 'bg-white' : 'bg-white/40'}`} />)}
        </div>
      )}
      {n > 1 && <span className="sr-only" aria-live="polite">{`Photo ${i + 1} of ${n}`}</span>}
      {profile.fictional && photos[i] && <span className="pointer-events-none absolute right-3 top-5 rounded-full bg-plum/45 px-2 py-0.5 text-[10px] text-white/80">Fictional · AI-generated photo</span>}
    </div>
  );
}
