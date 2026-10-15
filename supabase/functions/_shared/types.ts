// Shared between the website (src/) and the Supabase Edge Function (supabase/functions/api).
// Keep this folder free of runtime-specific imports so both Vite and Deno can read it.

export type Option = { id: string; label: string };

// The current pilot is accounting and finance only. Ids are stable; labels can change.
export const SKILL_OPTIONS: Option[] = [
  { id: 'financial_reporting', label: 'Financial reporting' },
  { id: 'budgeting', label: 'Budgeting' },
  { id: 'netsuite', label: 'NetSuite' },
  { id: 'quickbooks', label: 'QuickBooks' },
  { id: 'accounting_systems', label: 'Accounting systems' },
  { id: 'audit_readiness', label: 'Audit readiness' },
  { id: 'grant_accounting', label: 'Grant accounting' },
  { id: 'internal_controls', label: 'Internal controls' },
  { id: 'month_end_close', label: 'Month-end close' },
];
export const CAUSE_OPTIONS: Option[] = [
  { id: 'housing', label: 'Housing' },
  { id: 'youth', label: 'Youth' },
  { id: 'food_security', label: 'Food security' },
  { id: 'arts', label: 'Arts' },
  { id: 'education', label: 'Education' },
];
export const FORMATS = ['Remote', 'Hybrid', 'On-site'] as const;

export type Kind = 'volunteer' | 'nonprofit';
export type Format = (typeof FORMATS)[number];

export type Terms = {
  hoursPerWeek: number;
  weeks: number;
  minWeeks: number;
  maxWeeks: number;
  startDate: string; // YYYY-MM-DD
  availableUntil: string; // YYYY-MM-DD
  format: Format;
};
export type Prompts = { first: string; second: string; third: string };
export type Quote = { author: string; text: string; projectTitle: string; fictional?: boolean };

export type ReviewKind = 'organization' | 'identity' | 'credential';
export type ReviewStatus = 'not_submitted' | 'pending' | 'reviewed' | 'rejected' | 'needs_update';
export type ReviewBadge = { kind: ReviewKind; status: ReviewStatus; method: string; decidedAt: string; demo?: boolean };
export type TrackRecord = { completedProjects: number; hoursSelfReported: number; hoursConfirmed: number };

export type Profile = {
  id: string;
  kind: Kind;
  name: string;
  title: string;
  years: number | null; // volunteers: years of experience
  credential: string; // volunteers: self-reported
  foundedYear: number | null; // nonprofits
  photos: string[];
  skills: string[]; // skill ids
  causes: string[]; // cause ids
  terms: Terms;
  prompts: Prompts;
  paused: boolean;
  deleted?: boolean;
  fictional?: boolean; // demo fixtures only
  // Computed by the engine on every read. Never accepted from the client.
  record?: TrackRecord;
  reviews?: ReviewBadge[];
  quotes?: Quote[];
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
  notesLeft: number; // interest messages remaining for this posting; never resets
  visible?: boolean; // computed: false while the organization is waiting for review
};

export type Prospect = { profile: Profile; posting: Posting; interestedInYou: boolean; note: string };
export type Message = { id: string; senderId: string; senderName: string; text: string; createdAt: string; system?: boolean };
export type Deliverable = { id: string; text: string; done: boolean };
export type SystemLink = { id: string; name: string; url: string };
export type TeamMember = { id: string; name: string; role: string; email: string };
export type HourEntry = { id: string; date: string; hours: number; note: string };

export const ACCESS_LEVELS = [
  { id: 'none', label: 'No system access', hint: 'The volunteer works from exports, screen shares, or documents you choose to send.' },
  { id: 'read_only', label: 'Read-only access', hint: 'A named, view-only login. No changes to records.' },
  { id: 'limited', label: 'Limited named role', hint: 'A specific role you name below, with only the permissions the work needs. Never administrator.' },
] as const;
export type AccessLevel = (typeof ACCESS_LEVELS)[number]['id'];

// The one-page work agreement both sides accept before a project starts.
export type AgreementFields = {
  title: string;
  nonprofitContact: string;
  problem: string;
  outcome: string;
  deliverables: string;
  acceptance: string;
  inScope: string;
  exclusions: string;
  inputs: string;
  hoursPerWeek: number;
  weeks: number;
  format: Format;
  proposedStart: string; // YYYY-MM-DD
  accessLevel: AccessLevel;
  accessSystems: string;
  accessGrantedBy: string;
  accessRemovedBy: string;
  checkInPlan: string;
};
export type Agreement = AgreementFields & { version: number; editedBy: string; editedByName: string; editedAt: string };
export type Acceptance = {
  side: Kind;
  actorId: string;
  actorName: string;
  version: number;
  at: string;
  confidentiality: boolean;
  licensing: boolean;
};
export type Closing = {
  note: string;
  at: string;
  publish: boolean;
  unblocked?: 'yes' | 'partly' | 'no'; // nonprofit only: "Did this unblock you?"
  hoursOk?: boolean; // nonprofit only: confirms the volunteer's self-reported hours
};
export type Kickoff = { contact: boolean; scope: boolean; inputs: boolean; access: boolean };

// Stored states. "scope pending" and "awaiting confirmations" are both 'pending', told apart by the agreement.
export type ProjectStatus = 'pending' | 'active' | 'completion_pending' | 'closed' | 'passed' | 'lapsed' | 'ended_early';
export type Project = {
  id: string;
  posting: Posting;
  volunteer: Profile;
  nonprofit: Profile;
  status: ProjectStatus;
  createdAt: string; // mutual-interest time, UTC
  pendingUntil: string; // createdAt + 72 h, UTC
  agreement: Agreement;
  agreementHistory: Agreement[];
  acceptances: Acceptance[];
  agreedVersion: number | null;
  startDate: string; // agreed start, YYYY-MM-DD ('' until agreed)
  endDate: string; // YYYY-MM-DD ('' until agreed)
  kickoff: Kickoff;
  messages: Message[];
  deliverables: Deliverable[];
  links: SystemLink[];
  team: TeamMember[];
  hours: HourEntry[];
  checkInDate: string;
  checkInAgenda: string;
  closing: { volunteer?: Closing; nonprofit?: Closing };
  endedBy?: string;
  endedReason?: string;
  endedAt?: string;
  // Computed on read
  week?: number;
  totalHours?: number;
  weekHours?: number;
  finalWeek?: boolean;
  volunteerConfirmed?: boolean;
  nonprofitConfirmed?: boolean;
  missing?: string[]; // agreement fields still needed before anyone can confirm
  minStart?: string; // earliest allowed start date
};

export type NotificationKind =
  | 'interest' | 'mutual' | 'agreement_changed' | 'other_confirmed' | 'confirmed' | 'expired' | 'passed'
  | 'message' | 'ended' | 'completion_requested' | 'completed';
export type AppNotification = { id: string; kind: NotificationKind; text: string; projectId?: string; postingId?: string; createdAt: string; readAt: string | null };

export type ReportCategory = 'harassment' | 'unsafe_access' | 'impersonation' | 'spam' | 'misleading' | 'other';
export const REPORT_CATEGORIES: { id: ReportCategory; label: string }[] = [
  { id: 'harassment', label: 'Harassment' },
  { id: 'unsafe_access', label: 'Unsafe or sensitive access request' },
  { id: 'impersonation', label: 'Impersonation' },
  { id: 'spam', label: 'Spam' },
  { id: 'misleading', label: 'Misleading posting' },
  { id: 'other', label: 'Something else' },
];

export type AppState = {
  profile: Profile | null;
  needsOnboarding: boolean;
  postings: Posting[];
  prospects: Prospect[];
  capacity: { full: boolean; projectId?: string; reason: string };
  reviewGate: { waiting: boolean; status: ReviewStatus } | null; // nonprofits: discovery waits for organization review
  projects: Project[];
  notice: { kind: 'mutual' | 'confirmed' | 'ended'; projectId: string } | null;
  notifications: AppNotification[];
  unread: number;
  blocked: { id: string; name: string }[];
  demo: boolean;
};

export type AppConfig = {
  supportUrl: string | null; // set by the operator; null means support isn't configured
  policiesPublished: boolean;
};

export type ActionName =
  | 'onboard' | 'update_profile' | 'pause' | 'create_posting' | 'update_posting'
  | 'interest' | 'not_now' | 'edit_agreement' | 'confirm' | 'pass' | 'message' | 'log_hours'
  | 'add_deliverable' | 'toggle_deliverable' | 'kickoff' | 'check_in' | 'add_link' | 'remove_link'
  | 'add_member' | 'remove_member' | 'complete' | 'end_early' | 'acknowledge'
  | 'report' | 'block' | 'unblock' | 'read_notifications' | 'demo_advance_week';

export type ActionInput = {
  action: ActionName;
  postingId?: string;
  volunteerId?: string;
  projectId?: string;
  itemId?: string;
  targetId?: string;
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
  agreement?: AgreementFields;
  version?: number;
  confidentiality?: boolean;
  licensing?: boolean;
  unblocked?: 'yes' | 'partly' | 'no';
  hoursOk?: boolean;
  publish?: boolean;
  category?: ReportCategory;
  clientId?: string;
  ids?: string[];
};
export type ActionResult = { ok: boolean; message: string; projectId?: string; field?: string };
