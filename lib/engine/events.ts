// Replays the event log on top of the uploaded rows. Everything that happens after the upload
// (updates, withdrawals, overrides, milestones, date moves) lives here, so a run is fully
// reproducible from (rows, events, today).

import { cityForPin, addDays } from './normalize';
import { rawKeys } from './validate';
import type { EngineEvent, EngineInput, RawApplication } from './types';

export const PATCHABLE_FIELDS = ['spaceAvailable', 'spaceSize', 'floor', 'investment', 'experience', 'targetLaunch', 'pin', 'city', 'language', 'notes', 'business', 'applicantName', 'state'] as const;
export type PatchField = (typeof PATCHABLE_FIELDS)[number];

export interface EventState {
  applications: RawApplication[];
  keys: (string | null)[];
  today: string;
  daysAdvanced: number;
  withdrawn: Map<string, EngineEvent>;
  overrides: EngineEvent[];
  milestones: Map<string, { stage: string; at: string }[]>;
  checklist: Map<string, Record<string, { status: string; at: string }>>;
  missed: Map<string, EngineEvent>;
  actionsDone: Set<string>;
  byApplication: Map<string, EngineEvent[]>;
  unresolved: EngineEvent[];
}

export function resolveKey(ref: string | undefined, keys: (string | null)[]): string | null {
  if (!ref) return null;
  const r = ref.trim().toUpperCase();
  const k = keys.find((x) => x && x.toUpperCase() === r);
  return k ?? null;
}

export function applyEvents(input: EngineInput, today: string): EventState {
  const applications = input.applications.map((a) => ({ ...a }));
  const keys = rawKeys(applications);
  const state: EventState = {
    applications,
    keys,
    today,
    daysAdvanced: 0,
    withdrawn: new Map(),
    overrides: [],
    milestones: new Map(),
    checklist: new Map(),
    missed: new Map(),
    actionsDone: new Set(),
    byApplication: new Map(),
    unresolved: [],
  };

  for (const ev of input.events ?? []) {
    if (ev.type === 'dateAdvance') {
      const days = Number(ev.payload.days) || 0;
      if (days > 0) state.daysAdvanced += days;
      continue;
    }
    if (ev.type === 'checklist' && ev.payload.kind === 'action') {
      state.actionsDone.add(String(ev.payload.item));
      continue;
    }
    const key = resolveKey(ev.applicationId, keys);
    if (!key) {
      state.unresolved.push(ev);
      continue;
    }
    if (!state.byApplication.has(key)) state.byApplication.set(key, []);
    state.byApplication.get(key)!.push(ev);
    const idx = keys.indexOf(key);
    switch (ev.type) {
      case 'update': {
        const row = applications[idx];
        for (const f of PATCHABLE_FIELDS) {
          if (f in ev.payload) (row as Record<string, unknown>)[f] = ev.payload[f];
        }
        // Moving to a new pin in another city: follow the pin's city unless a city was given too.
        if ('pin' in ev.payload && !('city' in ev.payload)) {
          const c = cityForPin(String(ev.payload.pin).replace(/\D/g, ''));
          if (c) row.city = c.city;
        }
        break;
      }
      case 'withdraw':
        state.withdrawn.set(key, ev);
        break;
      case 'override':
        state.overrides.push({ ...ev, applicationId: key });
        break;
      case 'milestone': {
        const list = state.milestones.get(key) ?? [];
        list.push({ stage: String(ev.payload.stage ?? 'agreement'), at: ev.at });
        state.milestones.set(key, list);
        break;
      }
      case 'checklist': {
        const rec = state.checklist.get(key) ?? {};
        rec[String(ev.payload.item)] = { status: String(ev.payload.status), at: ev.at };
        state.checklist.set(key, rec);
        break;
      }
      case 'reservationMissed':
        state.missed.set(key, ev);
        break;
    }
  }
  state.today = addDays(today, state.daysAdvanced);
  return state;
}
