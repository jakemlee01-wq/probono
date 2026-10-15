import { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Prospect, Terms } from '@shared/types';
import { Tile } from './bits';
import { fmtDate, photoUrl } from '@/lib/util';

export function termsLine(t: Terms) {
  return `${t.hoursPerWeek} hrs/wk · ${t.weeks} wks · ${t.format}`;
}

// One prospect at a time: photos and their own words alternate as slides. Swipe or tap the arrows.
export function ProspectCard({ prospect, viewer }: { prospect: Prospect; viewer: 'volunteer' | 'nonprofit' }) {
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
  const role = fromPosting ? posting.title : [profile.title, profile.credential].filter(Boolean).join(' · ');
  const track = fromPosting
    ? `${profile.completedProjects} projects completed with volunteers`
    : `${profile.years} yrs experience · ${profile.completedProjects} projects · ${profile.hoursGiven} hours given`;

  return (
    <div className="rounded-[2rem] bg-plum2 p-3">
      <div
        className="relative aspect-[4/5] max-h-[58dvh] w-full touch-pan-y select-none overflow-hidden rounded-3xl border border-white/25 bg-plum3"
        onPointerDown={(e) => (x0.current = e.clientX)}
        onPointerUp={(e) => {
          if (x0.current === null) return;
          const d = e.clientX - x0.current;
          if (Math.abs(d) > 40) go(d < 0 ? 1 : -1);
          x0.current = null;
        }}
      >
        <div key={idx} className="slide-in absolute inset-0">
          {s.photo ? (
            <Tile name={profile.name} src={s.text ? photoUrl(s.text) : undefined} className="h-full w-full text-8xl" />
          ) : (
            <div className="flex h-full flex-col justify-center bg-plum3 px-7 pb-24 pt-16">
              {s.label && <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-white/60">{s.label}</p>}
              <p className="font-serif text-[1.8rem] leading-[1.2] text-white md:text-4xl">{s.text}</p>
            </div>
          )}
        </div>
        {s.photo && <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-plum/80 to-transparent" />}
        {prospect.interestedInYou && <span className="absolute left-3 top-3 rounded-full bg-white px-3 py-1 text-xs font-bold text-plum">Interested in you</span>}
        <span className="absolute right-3 top-3 rounded-full bg-plum/70 px-2.5 py-1 text-xs text-white">{idx + 1}/{slides.length}</span>
        <span className="absolute bottom-3 left-3 right-3 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-plum">{termsLine(terms)} · Starts {fmtDate(terms.startDate, 'MMM d')}</span>
        <button aria-label="Previous" onClick={() => go(-1)} disabled={idx === 0} className="absolute left-2 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-plum/60 text-white disabled:opacity-20 md:flex"><ChevronLeft size={20} /></button>
        <button aria-label="Next" onClick={() => go(1)} disabled={idx >= slides.length - 1} className="absolute right-2 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-plum/60 text-white disabled:opacity-20 md:flex"><ChevronRight size={20} /></button>
      </div>
      <div className="px-2 pb-2 pt-4">
        <h2 className="font-serif text-4xl leading-none text-white">{profile.name}</h2>
        <p className="mt-1.5 text-sm text-white/90">{role}</p>
        <p className="mt-1 text-xs text-white/60">{track}</p>
      </div>
      {prospect.interestedInYou && prospect.note && (
        <div className="mt-2 rounded-2xl bg-white/10 p-4">
          <p className="font-serif text-lg italic leading-snug text-white/90">"{prospect.note}"</p>
        </div>
      )}
      {profile.quotes.length > 0 && (
        <div className="mt-3 border-t border-white/15 px-2 pt-3 text-white/75">
          <p className="text-xs font-semibold">{fromPosting ? 'Volunteers who worked with us' : 'From past nonprofits'}</p>
          {profile.quotes.slice(-2).map((q, j) => (
            <blockquote key={j} className="mt-2 text-sm">“{q.text}”<cite className="mt-1 block text-xs not-italic text-white/50">{q.author}</cite></blockquote>
          ))}
        </div>
      )}
    </div>
  );
}
