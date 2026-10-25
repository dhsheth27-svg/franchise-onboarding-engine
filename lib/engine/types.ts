import type { Tier } from '../config';

export type Outcome = 'APPROVED' | 'APPROVED_WITH_CONDITIONS' | 'HOLD' | 'WAITLISTED' | 'REJECTED';
export type Severity = 'BLOCKING' | 'WARNING' | 'INFO';
export type Language = 'Kannada' | 'English' | 'Hindi';
export type Tenure = 'Owned' | 'Rented' | 'Not yet identified';
export type Floor = 'Ground' | 'Upper' | 'Mall unit' | 'Not known';
export type Priority = 'High' | 'Medium' | 'Low';
export type Confidence = 'High' | 'Medium' | 'Low';

// ---------- Raw input (as it arrives from Excel; anything may be wrong) ----------

export interface RawApplication {
  rowNumber?: number;
  applicationId?: unknown;
  applicantName?: unknown;
  city?: unknown;
  state?: unknown;
  pin?: unknown;
  investment?: unknown;
  experience?: unknown;
  business?: unknown;
  spaceAvailable?: unknown;
  spaceSize?: unknown;
  floor?: unknown;
  targetLaunch?: unknown;
  language?: unknown;
  notes?: unknown;
  /** Set by a follow-up update that reports a space without its size (see DECISIONS.md #18). */
  spaceSizePending?: boolean;
}

export interface RawTerritory {
  rowNumber?: number;
  territoryId?: unknown;
  city?: unknown;
  state?: unknown;
  pins?: unknown;
  tier?: unknown;
  openSlots?: unknown;
  priority?: unknown;
}

export interface RawStore {
  storeId?: unknown;
  city?: unknown;
  pin?: unknown;
  openedYear?: unknown;
}

export type EventType = 'update' | 'withdraw' | 'override' | 'milestone' | 'checklist' | 'reservationMissed' | 'dateAdvance';

export interface EngineEvent {
  id: string;
  type: EventType;
  applicationId?: string;
  payload: Record<string, unknown>;
  reason?: string;
  by?: string;
  /** ISO date (YYYY-MM-DD) in the engine's timeline when the event happened. */
  at: string;
}

export interface EngineInput {
  applications: RawApplication[];
  territories: RawTerritory[];
  existingStores?: RawStore[];
  events: EngineEvent[];
  /** Approval date per application key, carried forward from the parent run version. */
  priorApprovals?: Record<string, string>;
  /** Signals extracted by the LLM before the run, keyed by application key. Deterministic extraction is used otherwise. */
  llmSignals?: Record<string, Signals>;
  source?: string;
  importNotes?: string[];
  /** Team policy (threshold and slot overrides); see lib/policy.ts. Applied before the engine runs. */
  policy?: { territorySlots?: Record<string, number>; [key: string]: unknown };
}

// ---------- Cleaned records ----------

export interface Flag {
  code: string;
  severity: Severity;
  field?: string;
  /** Plain-language description for the team. */
  message: string;
  /** Facts used to build applicant-facing asks in any language. */
  params?: Record<string, string | number>;
}

export interface CleanNote {
  field: string;
  from: string;
  to: string;
  note: string;
}

export interface Signals {
  businessCategory: string;
  relevance: 'high' | 'medium' | 'low' | 'unknown';
  commitment: 'full' | 'partial' | 'unknown';
  mentionsDeadline: boolean;
  deadlineLabel?: string;
  deadlineDate?: string;
  hiresManager: boolean;
  loanPending: boolean;
  flexibleOnLocation: boolean;
  preferredCities: string[];
  sideBusiness: boolean;
  statedYears?: number;
  contradictions: string[];
  method: 'deterministic' | 'llm';
}

export interface Application {
  key: string; // unique within the run (duplicate IDs get a suffix)
  id: string; // as displayed
  rowNumber: number | null;
  name: string;
  city: string | null; // canonical city if recognised, else the raw text
  cityRecognised: boolean;
  pinCity: string | null; // city implied by the pin prefix
  state: string | null;
  pin: string | null;
  investmentLakh: number | null;
  experienceYears: number | null;
  business: string;
  space: Tenure | null;
  spaceSqft: number | null;
  floor: Floor | null;
  targetLaunchMonths: number | null;
  effectiveLaunchMonths: number;
  language: Language;
  notes: string;
  signals: Signals;
  flags: Flag[];
  cleaning: CleanNote[];
}

export interface Territory {
  id: string;
  rowNumber: number | null;
  city: string;
  state: string;
  pins: string[];
  tier: Tier;
  openSlots: number;
  priority: Priority;
  issues: string[];
}

export interface Store {
  storeId: string;
  city: string;
  pin: string;
  openedYear: number;
}

// ---------- Decisions ----------

export type TraceResult = 'pass' | 'fail' | 'flag' | 'info' | 'skip';

export interface TraceStep {
  step: 'clean' | 'validate' | 'gate' | 'score' | 'allocate' | 'override' | 'reservation' | 'event';
  check: string;
  code?: string;
  result: TraceResult;
  values: Record<string, unknown>;
  sentence: string;
}

export interface Pillar {
  key: 'financial' | 'operator' | 'site' | 'launch' | 'territory';
  label: string;
  raw: number; // 0..100
  weight: number;
  points: number; // raw * weight / 100
  explanation: string;
}

export interface Pillars {
  financial: Pillar;
  operator: Pillar;
  site: Pillar;
  launch: Pillar;
  territory: Pillar;
  cannibalisationDeduction: { points: number; max: number; explanation: string };
}

export interface Redirect {
  territoryId: string;
  city: string;
  priority: Priority;
  sameCity: boolean;
  openSlotsLeft: number;
  freePins: string[];
  projectedRank: number | null;
  projectedOf: number | null;
  sentence: string;
}

export interface Counterfactual {
  kind: 'space' | 'capital' | 'data' | 'competitor' | 'move' | 'score' | 'launch';
  change: string;
  outcome: Outcome;
  rank: number | null;
  sentence: string;
}

export interface Condition {
  code: string;
  text: string;
  deadline: string;
}

export type ReservationStatus = 'Active' | 'Due soon' | 'Expired' | 'Fulfilled';

export interface Reservation {
  approvedOn: string;
  deadline: string;
  status: ReservationStatus;
  daysLeft: number;
  pin: string;
  territoryId: string;
}

export interface Override {
  outcome: Outcome;
  reason: string;
  by: string;
  at: string;
  status: 'applied' | 'refused';
  conflict?: string;
  released?: string;
}

export type ChecklistStatus = 'Not started' | 'In progress' | 'Done' | 'Blocked';

export interface PlanStep {
  id: string;
  stage: string;
  detail: string;
  owner: 'Brand' | 'Partner' | 'Both';
  startWeek: number;
  endWeek: number;
  dueDate: string;
  status: ChecklistStatus;
  added?: string; // why this step was added (gap-based)
}

export interface OnboardingPlan {
  trainingTrack: 'Extended' | 'Standard' | 'Compressed';
  trainingLanguage: Language;
  steps: PlanStep[];
  preconditions: Condition[];
  earliestOpening: string;
  targetOpening: string;
  timelineNote: string;
  weeksToOpen: number;
}

export interface ChecklistItem {
  id: string;
  label: string;
  status: ChecklistStatus;
  note?: string;
}

export interface Risk {
  level: 'Low' | 'Medium' | 'High';
  reasons: string[];
  actions: string[];
}

export interface Decision {
  key: string;
  applicationId: string;
  applicantName: string;
  rowNumber: number | null;
  city: string | null;
  pin: string | null;
  territoryId: string | null;
  tier: Tier | null;
  language: Language;
  outcome: Outcome;
  engineOutcome: Outcome;
  override?: Override;
  withdrawn?: boolean;
  score: number | null;
  provisionalScore: boolean;
  scoreNote?: string;
  pillars: Pillars | null;
  confidence: Confidence;
  confidenceReasons: string[];
  rankInTerritory: number | null;
  slotRank?: number;
  provisionalRank?: number;
  pinTakenBy?: string;
  territorySlots?: number;
  waitlistPosition?: number;
  reasons: string[];
  primaryReason: string;
  trace: TraceStep[];
  summary: string;
  oneLine: string;
  whatWouldChange: Counterfactual[];
  redirects: Redirect[];
  conditions: Condition[];
  reservation?: Reservation;
  risk?: Risk;
  onboarding: OnboardingPlan | null;
  documents?: ChecklistItem[];
  readiness?: { items: ChecklistItem[]; percent: number; readyToOpen: boolean };
  message: { language: Language; text: string; english: string; sent?: { at: string; channel: string; by: string; current: boolean } };
  estimatedPaybackMonths: number | null;
  flags: Flag[];
  cleaning: CleanNote[];
  signals: Signals;
  competitor?: { key: string; id: string; score: number; margin: number };
  application: Application;
}

export interface TerritorySummary {
  id: string;
  city: string;
  tier: Tier;
  priority: Priority;
  openSlots: number;
  pins: string[];
  existingStorePins: string[];
  freePinsAtStart: string[];
  freePinsNow: string[];
  realCapacity: number;
  approved: string[];
  waitlisted: string[];
  held: string[];
  pinsUsed: Record<string, string>;
  slotsLeft: number;
  unfilled: number;
  issues: string[];
}

export interface DataIssue {
  scope: 'application' | 'territory' | 'store' | 'file';
  ref: string;
  code: string;
  severity: Severity;
  message: string;
}

export interface ActionItem {
  id: string;
  priority: number;
  category: 'deadline' | 'hold' | 'risk' | 'redirect' | 'recruit' | 'data';
  who: string;
  what: string;
  why: string;
  deadline: string | null;
  applicationKey?: string;
  territoryId?: string;
  done: boolean;
}

export interface AssertionResult {
  ok: boolean;
  violations: string[];
}

export interface RunResult {
  asOf: string;
  decisions: Decision[];
  territories: TerritorySummary[];
  stores: Store[];
  dataIssues: DataIssue[];
  assertions: AssertionResult;
  approvalDates: Record<string, string>;
  actions: ActionItem[];
  counts: Record<Outcome, number>;
  durationMs: number;
}
