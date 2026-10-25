// Optional LLM helpers (OpenAI). Used only when OPENAI_API_KEY is set; every call has a short timeout
// and any failure (network, refusal, invalid JSON, schema mismatch) falls back to the rules.
// The model only parses text into structured data. It never decides an outcome.

import OpenAI from 'openai';
import { z } from 'zod';
import type { Signals } from './engine/types';
import type { Intent, Patch } from './followup';

const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

export const llmEnabled = () => !!process.env.OPENAI_API_KEY;

function client(timeoutMs: number) {
  return new OpenAI({ timeout: timeoutMs, maxRetries: 0 });
}

/** One structured-output call: the response must match the JSON schema (strict mode), else null. */
async function jsonCall(system: string, user: string, schema: Record<string, unknown>, timeoutMs: number, name: string): Promise<unknown | null> {
  if (!llmEnabled()) return null;
  try {
    const res = await client(timeoutMs).chat.completions.create({
      model: MODEL,
      temperature: 0,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      response_format: { type: 'json_schema', json_schema: { name, strict: true, schema } },
    });
    const choice = res.choices[0];
    if (!choice || choice.message.refusal || choice.finish_reason !== 'stop' || !choice.message.content) return null;
    return JSON.parse(choice.message.content);
  } catch (e) {
    if (e instanceof OpenAI.APIError) console.warn(`LLM call failed (${e.status}); using rules.`);
    else console.warn('LLM call failed; using rules.', e instanceof Error ? e.message : e);
    return null;
  }
}

// ---------- Intent parsing ----------

const PATCH_KEYS = ['spaceAvailable', 'spaceSize', 'floor', 'investment', 'experience', 'targetLaunch', 'pin', 'language', 'notes'] as const;

const IntentSchema = z.object({
  intent: z.enum(['explain', 'compare', 'status', 'territories', 'whatif', 'update', 'withdraw', 'reservationMissed', 'milestone', 'dateAdvance', 'actions', 'overview', 'unclear']),
  applicationIds: z.array(z.string()),
  territoryId: z.string().nullable(),
  city: z.string().nullable(),
  days: z.number().nullable(),
  patch: z.object({
    spaceAvailable: z.enum(['Owned', 'Rented', 'Not yet identified']).nullable(),
    spaceSize: z.number().nullable(),
    floor: z.enum(['Ground', 'Upper', 'Mall unit', 'Not known']).nullable(),
    investment: z.number().nullable(),
    experience: z.number().nullable(),
    targetLaunch: z.number().nullable(),
    pin: z.string().nullable(),
    language: z.enum(['Kannada', 'English', 'Hindi']).nullable(),
    notes: z.string().nullable(),
  }),
});

const nullable = (t: string) => ({ type: [t, 'null'] });
const INTENT_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['intent', 'applicationIds', 'territoryId', 'city', 'days', 'patch'],
  properties: {
    intent: { type: 'string', enum: IntentSchema.shape.intent.options },
    applicationIds: { type: 'array', items: { type: 'string' } },
    territoryId: nullable('string'),
    city: nullable('string'),
    days: nullable('number'),
    patch: {
      type: 'object',
      additionalProperties: false,
      required: [...PATCH_KEYS],
      properties: {
        spaceAvailable: { type: ['string', 'null'], enum: ['Owned', 'Rented', 'Not yet identified', null] },
        spaceSize: nullable('number'),
        floor: { type: ['string', 'null'], enum: ['Ground', 'Upper', 'Mall unit', 'Not known', null] },
        investment: nullable('number'),
        experience: nullable('number'),
        targetLaunch: nullable('number'),
        pin: nullable('string'),
        language: { type: ['string', 'null'], enum: ['Kannada', 'English', 'Hindi', null] },
        notes: nullable('string'),
      },
    },
  },
};

const INTENT_SYSTEM = `You convert a franchise expansion team member's message into a structured intent. You never decide outcomes.
Intents: explain (why an application got its decision), compare (two applications), status (one territory or city), territories (which territories still have room / open slots / where new stores can go), whatif (hypothetical change, nothing saved), update (new real information about an applicant), withdraw, reservationMissed (missed deadline), milestone (e.g. signed the agreement), dateAdvance (move the date forward N days), actions (what the team should do today), overview (overall counts and results), unclear.
Identify applicants from the directory. If the message gives an ID, use it exactly. If it describes someone (by name, city, business), use the ID only when exactly one directory entry clearly matches; if none or several could match, return no IDs and intent "unclear". Never guess.
Only fill patch fields the message explicitly states; leave every other field null. If a space was found but the message does not say owned or rented, set spaceAvailable to "Rented" (never assume "Owned"). Convert number words ("four hundred") to numbers. Investment is in lakh rupees, size in sq ft, experience in years, target launch in months.`;

/** `directory` is one line per applicant: "ID | name | city | business" (used only to resolve who the message is about). */
export async function parseIntentLLM(message: string, directory: string[]): Promise<{ raw: z.infer<typeof IntentSchema> } | null> {
  const out = await jsonCall(INTENT_SYSTEM, `Applicant directory (ID | name | city | business):\n${directory.slice(0, 500).join('\n')}\n\nMessage: ${message}`, INTENT_JSON_SCHEMA, 9000, 'followup_intent');
  const parsed = IntentSchema.safeParse(out);
  return parsed.success ? { raw: parsed.data } : null;
}

export function llmToIntent(raw: z.infer<typeof IntentSchema>, resolve: (id: string) => string | null): Intent | null {
  const ids = raw.applicationIds.map(resolve).filter((x): x is string => !!x);
  const patch: Patch = {};
  for (const k of PATCH_KEYS) {
    const v = raw.patch[k];
    if (v !== null && v !== undefined) (patch as Record<string, unknown>)[k] = v;
  }
  switch (raw.intent) {
    case 'explain':
      return ids[0] ? { kind: 'explain', id: ids[0] } : null;
    case 'compare':
      return ids.length >= 2 ? { kind: 'compare', a: ids[0], b: ids[1] } : null;
    case 'status':
      return raw.territoryId || raw.city ? { kind: 'status', territoryId: raw.territoryId ?? undefined, city: raw.city ?? undefined } : null;
    case 'whatif':
    case 'update':
      return ids[0] && Object.keys(patch).length ? { kind: raw.intent, id: ids[0], patch, notes: [] } : null;
    case 'withdraw':
    case 'reservationMissed':
      return ids[0] ? { kind: raw.intent, id: ids[0] } : null;
    case 'milestone':
      return ids[0] ? { kind: 'milestone', id: ids[0], stage: 'agreement' } : null;
    case 'dateAdvance':
      return raw.days && raw.days > 0 ? { kind: 'dateAdvance', days: Math.round(raw.days) } : null;
    case 'actions':
      return { kind: 'actions' };
    case 'overview':
      return { kind: 'overview' };
    case 'territories':
      return { kind: 'territories' };
    default:
      return null;
  }
}

// ---------- Free-text signal extraction (upload time) ----------

const SignalsItem = z.object({
  key: z.string(),
  businessCategory: z.string(),
  relevance: z.enum(['high', 'medium', 'low', 'unknown']),
  commitment: z.enum(['full', 'partial', 'unknown']),
  hiresManager: z.boolean(),
  loanPending: z.boolean(),
  flexibleOnLocation: z.boolean(),
  sideBusiness: z.boolean(),
  statedYears: z.number().nullable(),
});

const SIGNALS_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['items'],
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['key', 'businessCategory', 'relevance', 'commitment', 'hiresManager', 'loanPending', 'flexibleOnLocation', 'sideBusiness', 'statedYears'],
        properties: {
          key: { type: 'string' },
          businessCategory: { type: 'string' },
          relevance: { type: 'string', enum: ['high', 'medium', 'low', 'unknown'] },
          commitment: { type: 'string', enum: ['full', 'partial', 'unknown'] },
          hiresManager: { type: 'boolean' },
          loanPending: { type: 'boolean' },
          flexibleOnLocation: { type: 'boolean' },
          sideBusiness: { type: 'boolean' },
          statedYears: { type: ['number', 'null'] },
        },
      },
    },
  },
};

const SIGNALS_SYSTEM = `You read franchise applicants' free-text answers and extract signals. Relevance of the business background to running a retail store: high (footwear, apparel, garments, mobile, electronics, accessories, eyewear/optical, grocery/kirana, pharmacy, cosmetics, general retail, franchise owner), medium (restaurant, cafe, salon, distributor, wholesale, sales job), low (IT/office job, student, homemaker, none), unknown (blank or unclear). commitment is partial for part-time, side business, or a hired manager running the store. statedYears = years of shop experience claimed in the text, else null. Return one item per input key.`;

/** Returns LLM signals keyed by application key, or null to use the deterministic extractor. */
export async function extractSignalsLLM(rows: { key: string; business: string; notes: string }[], deterministic: Record<string, Signals>): Promise<Record<string, Signals> | null> {
  if (!llmEnabled() || !rows.length || rows.length > 150) return null;
  const out = await jsonCall(SIGNALS_SYSTEM, JSON.stringify(rows), SIGNALS_JSON_SCHEMA, 20000, 'applicant_signals');
  const parsed = z.object({ items: z.array(SignalsItem) }).safeParse(out);
  if (!parsed.success) return null;
  const result: Record<string, Signals> = {};
  for (const it of parsed.data.items) {
    const base = deterministic[it.key];
    if (!base) continue;
    // Deadlines and preferred cities stay deterministic (they are date/config maths, not reading).
    result[it.key] = {
      ...base,
      businessCategory: it.businessCategory,
      relevance: it.relevance,
      commitment: it.commitment,
      hiresManager: it.hiresManager,
      loanPending: it.loanPending,
      flexibleOnLocation: it.flexibleOnLocation || base.flexibleOnLocation,
      sideBusiness: it.sideBusiness,
      statedYears: it.statedYears ?? undefined,
      method: 'llm',
    };
  }
  return Object.keys(result).length ? result : null;
}
