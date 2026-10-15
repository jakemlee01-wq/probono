// Shared between the website (src/) and the Supabase Edge Function (supabase/functions/api).
// Keep this file free of imports so both Vite and Deno can read it.

export const SKILLS = ['Financial reporting', 'Budgeting', 'NetSuite', 'QuickBooks', 'Accounting systems', 'Audit readiness', 'Grant accounting', 'Internal controls', 'Month-end close'];
export const CAUSES = ['Housing', 'Youth', 'Food security', 'Arts', 'Education'];
export const FORMATS = ['Remote', 'Hybrid', 'On-site'] as const;

export type Kind = 'volunteer' | 'nonprofit';
export type Format = (typeof FORMATS)[number];

export type Terms = {
  hoursPerWeek: number;
  weeks: number;
  minWeeks: number;
  maxWeeks: number;
  startDate: string;
  availableUntil: string;
  format: Format;
};
export type Prompts = { first: string; second: string; third: string };
export type Quote = { author: string; text: string };

export type Profile = {
  id: string;
  kind: Kind;
  name: string;
  title: string;
  years: number;
  credential: string;
  photos: string[];
  skills: string[];
  causes: string[];
  terms: Terms;
  prompts: Prompts;
  paused: boolean;
  completedProjects: number;
  hoursGiven: number;
  quotes: Quote[];
};

export type PostingStatus = 'Open' | 'Pending' | 'Active project' | 'Complete';
export type Posting = {
  id: string;
  orgId: string;
  title: string;
  skills: string[];
  terms: Terms;
  prompts: Prompts;
  status: PostingStatus;
  notesLeft: number;
};

export type Prospect = { profile: Profile; posting: Posting; interestedInYou: boolean; note: string };
export type Message = { id: string; senderId: string; senderName: string; text: string; createdAt: string };
export type Deliverable = { id: string; text: string; done: boolean };
export type SystemLink = { id: string; name: string; url: string };
export type TeamMember = { id: string; name: string; role: string; email: string };
export type HourEntry = { id: string; date: string; hours: number; note: string };

export type ProjectStatus = 'pending' | 'active' | 'wrapping_up' | 'closed' | 'passed' | 'lapsed' | 'ended_early';
export type Project = {
  id: string;
  posting: Posting;
  volunteer: Profile;
  nonprofit: Profile;
  status: ProjectStatus;
  pendingUntil: string;
  volunteerConfirmed: boolean;
  nonprofitConfirmed: boolean;
  startDate: string;
  endDate: string;
  week: number;
  totalHours: number;
  weekHours: number;
  messages: Message[];
  deliverables: Deliverable[];
  links: SystemLink[];
  team: TeamMember[];
  hours: HourEntry[];
  checkInDate: string;
  checkInAgenda: string;
  volunteerClosingNote: string;
  nonprofitClosingNote: string;
};

export type Mode = 'discovery' | 'pending' | 'project';
export type AppState = {
  profile: Profile | null;
  needsOnboarding: boolean;
  mode: Mode;
  postings: Posting[];
  prospects: Prospect[];
  projects: Project[];
  currentProject: Project | null;
  lastClosedProject: Project | null;
  notification: '' | 'mutual' | 'confirmed' | 'closed';
};

export type DemoAccountId = 'sally' | 'marcus' | 'riverside' | 'northside';
export type DemoAccount = { id: DemoAccountId; name: string; kind: Kind };
export type AppConfig = { skills: string[]; causes: string[]; demoMode: boolean; demoAccounts: DemoAccount[] };

export type ActionName =
  | 'onboard' | 'update_profile' | 'pause' | 'create_posting' | 'update_posting'
  | 'interest' | 'not_now' | 'confirm' | 'pass' | 'message' | 'log_hours'
  | 'add_deliverable' | 'toggle_deliverable' | 'check_in' | 'add_link' | 'remove_link'
  | 'add_member' | 'remove_member' | 'close' | 'end_early' | 'acknowledge' | 'demo_advance_week';

export type ActionInput = {
  action: ActionName;
  postingId?: string;
  volunteerId?: string;
  projectId?: string;
  itemId?: string;
  note?: string;
  name?: string;
  url?: string;
  date?: string;
  hours?: number;
  paused?: boolean;
  inviteCode?: string;
  kind?: Kind;
  profile?: Profile;
  posting?: Posting;
  member?: TeamMember;
};
export type ActionResult = { ok: boolean; message: string; projectId?: string };
