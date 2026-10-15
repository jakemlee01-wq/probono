import type { AppState, Profile, Project } from '@shared/types';
import { Btn, Tile } from './bits';
import { HowItWorks } from './how';
import { Pending } from './pending';
import { ProjectSummary, Workspace } from './workspace';
import { fmtDate, photoUrl, projectLabel } from '@/lib/util';

const LIVE = ['pending', 'active', 'completion_pending'];

export function Projects({ state, me, openId, open, goDiscover }: { state: AppState; me: Profile; openId?: string; open: (id: string | null) => void; goDiscover: () => void }) {
  const project = openId ? state.projects.find((p) => p.id === openId) : undefined;
  if (openId && !project) {
    return (
      <div className="mx-auto mt-10 max-w-sm text-center text-plum">
        <h1 className="font-serif text-3xl">Project not found</h1>
        <p className="mt-2 text-sm text-plum/70">It may belong to another account, or it was removed.</p>
        <Btn className="mt-5" onClick={() => open(null)}>All projects</Btn>
      </div>
    );
  }
  if (project) {
    return (
      <div>
        <button onClick={() => open(null)} className="-mt-2 mb-3 min-h-11 text-sm font-semibold text-plum/75 underline underline-offset-4">← All projects</button>
        {project.status === 'pending' ? <Pending key={project.id} project={project} me={me} />
          : LIVE.includes(project.status) ? <Workspace key={project.id} project={project} me={me} demo={state.demo} />
          : <ProjectSummary project={project} me={me} />}
      </div>
    );
  }
  const live = state.projects.filter((p) => LIVE.includes(p.status));
  const past = state.projects.filter((p) => !LIVE.includes(p.status));
  return (
    <div className="mx-auto max-w-lg space-y-6 text-plum">
      <div className="flex items-end justify-between">
        <h1 className="font-serif text-4xl leading-none">Projects</h1>
        <HowItWorks kind={me.kind} />
      </div>
      {state.projects.length === 0 && (
        <div className="rounded-3xl border border-dashed border-plum/30 p-8 text-center">
          <p className="font-serif text-2xl">No projects yet</p>
          <p className="mt-2 text-sm text-plum/70">When you and {me.kind === 'volunteer' ? 'a nonprofit' : 'a volunteer'} are both interested, the proposed project shows up here.</p>
          <Btn className="mt-4" onClick={goDiscover}>Go to Discover</Btn>
        </div>
      )}
      {live.length > 0 && <List title="In progress" items={live} me={me} open={open} />}
      {past.length > 0 && <List title="Past" items={past} me={me} open={open} />}
    </div>
  );
}

function List({ title, items, me, open }: { title: string; items: Project[]; me: Profile; open: (id: string) => void }) {
  return (
    <section>
      <h2 className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-plum/65">{title}</h2>
      <ul className="space-y-2">
        {items.map((p) => {
          const other = me.kind === 'volunteer' ? p.nonprofit : p.volunteer;
          const s = projectLabel(p, me.kind);
          return (
            <li key={p.id}>
              <button onClick={() => open(p.id)} className="flex w-full items-center gap-3 rounded-3xl border border-plum/15 bg-white/50 p-3 text-left hover:bg-white/80">
                <Tile name={other.name} alt="" src={other.photos[0] ? photoUrl(other.photos[0]) : undefined} className="h-14 w-14 shrink-0 rounded-2xl text-xl" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{other.name}</span>
                  <span className="block truncate text-xs text-plum/70">{p.agreement.title}{p.startDate ? ` · ${fmtDate(p.startDate, 'MMM d')}` : ''}</span>
                  <span className="mt-0.5 block text-xs"><b>{s.label}</b> · {s.next}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
