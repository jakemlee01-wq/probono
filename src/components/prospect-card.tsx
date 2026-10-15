import { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
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

// One prospect at a time: photos and their own words alternate as slides. Swipe or use the arrows.
export function ProspectCard({ prospect, viewer, preview }: { prospect: Prospect; viewer: 'volunteer' | 'nonprofit'; preview?: boolean }) {
  const { profile, posting } = prospect;
  const fromPosting = viewer === 'volunteer';
  const terms = fromPosting ? posting.terms : profile.terms;
  const pr = fromPosting && posting.prompts.first ? posting.prompts : profile.prompts;
  const labels = fromPosting ? ['What we do', 'Where we are stuck', 'Success looks like'] : ["I'm best at", 'Causes close to me', 'Working with me looks like'];
  const prompts = [pr.first, pr.second, pr.third].map((text, k) => ({ text, label: labels[k] })).filter((x) => x.text);
  const photos = profile.photos.length ? profile.photos : [''];
  const slides: { photo: boolean; text: string; label?: string }[] = [];
  for (let k = 0; k < Math.max(photos.length, prompts.length); k++) {
    if (k < photos.length) slides.push({ photo: true, text: photos[k] });
    if (k < prompts.length) slides.push({ photo: false, text: prompts[k].text, label: prompts[k].label });
  }
  const [i, setI] = useState(0);
  const x0 = useRef<number | null>(null);
  const go = (d: number) => setI((v) => Math.min(slides.length - 1, Math.max(0, v + d)));
  const idx = Math.min(i, slides.length - 1);
  const s = slides[idx];
  const role = fromPosting ? posting.title : profile.title;
  const skills = (fromPosting ? posting.skills : profile.skills).map(optionLabel);
  const chips = [...skills, termsLine(terms), `${fromPosting ? 'Proposed start' : 'Free from'} ${fmtDate(terms.startDate, 'MMM d')}`];

  return (
    <article aria-label={profile.name} className="rounded-[2rem] bg-plum2 p-3">
      {/* Who it is comes first, above the photo, so the action bar can never hide it. */}
      <header className="px-2 pb-3 pt-1">
        <h2 className="font-serif text-[2.1rem] leading-none text-white">{profile.name}</h2>
        {role && <p className="mt-1.5 text-sm text-white/90">{role}</p>}
      </header>
      <div
        className="relative aspect-[4/5] max-h-[max(12rem,calc(100dvh-27rem))] min-h-[12rem] w-full touch-pan-y select-none overflow-hidden rounded-3xl border border-white/25 bg-plum3 md:max-h-[max(12rem,min(30rem,calc(100dvh-26rem)))]"
        onPointerDown={(e) => (x0.current = e.clientX)}
        onPointerUp={(e) => {
          if (x0.current === null) return;
          const d = e.clientX - x0.current;
          if (Math.abs(d) > 40) go(d < 0 ? 1 : -1);
          x0.current = null;
        }}
        onKeyDown={(e) => { if (e.key === 'ArrowRight') go(1); if (e.key === 'ArrowLeft') go(-1); }}
        tabIndex={0}
        role="group"
        aria-roledescription="carousel"
        aria-label={`${profile.name}: slide ${idx + 1} of ${slides.length}. Use the arrow keys to move.`}
      >
        <div key={idx} className="slide-in absolute inset-0">
          {s.photo ? (
            <Tile name={profile.name} alt={`Photo of ${profile.name}${profile.fictional ? ' (fictional, AI-generated)' : ''}`} src={s.text ? photoUrl(s.text) : undefined} className="h-full w-full text-8xl" />
          ) : (
            <div className="flex h-full flex-col justify-center overflow-y-auto bg-plum3 px-6 py-10">
              {s.label && <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-white/65">{s.label}</p>}
              <p className="font-serif text-[1.55rem] leading-[1.22] text-white md:text-3xl">{s.text}</p>
            </div>
          )}
        </div>
        {prospect.interestedInYou && <span className="absolute left-3 top-3 rounded-full bg-white px-3 py-1 text-xs font-bold text-plum">Interested in you</span>}
        <span className="absolute right-3 top-3 rounded-full bg-plum/75 px-2.5 py-1 text-xs text-white" aria-hidden>{idx + 1}/{slides.length}</span>
        {profile.fictional && s.photo && <span className="absolute bottom-3 left-3 rounded-full bg-plum/80 px-2.5 py-1 text-[11px] text-white">Fictional person · AI-generated photo</span>}
        <button aria-label="Previous slide" onClick={() => go(-1)} disabled={idx === 0} className="absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-plum/60 text-white disabled:opacity-0"><ChevronLeft size={20} /></button>
        <button aria-label="Next slide" onClick={() => go(1)} disabled={idx >= slides.length - 1} className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-plum/60 text-white disabled:opacity-0"><ChevronRight size={20} /></button>
      </div>
      <div className="px-2 pb-1 pt-4">
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Fit">
          {chips.map((c) => <li key={c} className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-plum">{c}</li>)}
        </ul>
        <p className="mt-3 text-xs text-white/70">{trackLine(profile)}</p>
        <Badges profile={profile} dark />
      </div>
      {prospect.interestedInYou && prospect.note && (
        <div className="mt-3 rounded-2xl bg-white/10 p-4">
          <p className="text-xs font-semibold text-white/70">Their message</p>
          <p className="mt-1 whitespace-pre-wrap font-serif text-lg italic leading-snug text-white/90">"{prospect.note}"</p>
        </div>
      )}
      {(profile.quotes?.length ?? 0) > 0 && (
        <div className="mt-3 border-t border-white/15 px-2 pt-3 text-white/80">
          <p className="text-xs font-semibold">{fromPosting ? 'From volunteers who worked with them' : 'From nonprofits they worked with'}</p>
          {profile.quotes!.map((q, j) => (
            <blockquote key={j} className="mt-2 text-sm">“{q.text}”<cite className="mt-1 block text-xs not-italic text-white/55">{q.author}, {q.projectTitle}{q.fictional ? ' · fictional demo quote' : ''}</cite></blockquote>
          ))}
        </div>
      )}
      {!preview && (
        <div className="px-1 pt-2 text-right">
          <SafetyButton tone="dark" targetId={profile.id} targetName={profile.name} postingId={posting.id} />
        </div>
      )}
    </article>
  );
}
