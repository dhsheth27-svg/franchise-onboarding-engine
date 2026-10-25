// Low-level cleaning helpers: every function returns a value (or null) plus a note describing
// what was changed, so the Data Quality report can show exactly what the engine did.

import { CITIES, type Tier } from '../config';
import type { Floor, Language, Priority, Tenure } from './types';

export interface Parsed<T> {
  value: T | null;
  /** Set when the input was changed to get the value (e.g. "₹25 lakh" -> 25). */
  note?: string;
  /** Set when the input was present but could not be understood. */
  error?: string;
}

const MISSING_TOKENS = new Set(['', 'n/a', 'na', 'n.a.', '-', '--', '—', 'nil', 'null', 'none', 'not applicable', '?', 'tbd', 'nan']);

export function asText(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).replace(/\s+/g, ' ').trim();
}

export function isMissing(v: unknown): boolean {
  return MISSING_TOKENS.has(asText(v).toLowerCase());
}

/** Parse a number that may carry units, currency symbols, commas or words. */
export function parseNumber(v: unknown, unit: 'lakh' | 'years' | 'sqft' | 'months' | 'count' = 'count'): Parsed<number> {
  if (typeof v === 'number') return Number.isFinite(v) ? { value: v } : { value: null, error: 'not a number' };
  if (isMissing(v)) return { value: null };
  const original = asText(v);
  let s = original.toLowerCase();
  let multiplier = 1;
  if (unit === 'lakh') {
    if (/crore|\bcr\b/.test(s)) multiplier = 100;
    else if (/\bk\b|thousand/.test(s)) multiplier = 0.01;
  }
  if (unit === 'months' && /\byears?\b|\byrs?\b/.test(s) && !/month/.test(s)) multiplier = 12;
  if (unit === 'years' && /month|mths?\b/.test(s) && !/year|yrs?\b/.test(s)) multiplier = 1 / 12;
  s = s
    .replace(/₹|rs\.?|inr|rupees?/g, '')
    .replace(/lakhs?|lacs?|crores?|\bcr\b|\bl\b|thousand|\bk\b/g, '')
    .replace(/years?|yrs?|\by\b/g, '')
    .replace(/sq\.?\s*ft\.?|sqft|square\s*feet|sft|\bft\b/g, '')
    .replace(/months?|mths?|\bmo\b/g, '')
    .replace(/approx\.?|about|around|~|only|\+|slots?|stores?/g, '')
    .replace(/,/g, '')
    .trim();
  // "20-25" or "20 to 25": take the lower bound (conservative)
  const range = s.match(/^(-?\d+(?:\.\d+)?)\s*(?:-|to|–)\s*(\d+(?:\.\d+)?)$/);
  if (range) {
    const value = parseFloat(range[1]) * multiplier;
    return { value, note: `"${original}" is a range; used the lower value ${value}` };
  }
  if (/^-?\d+(?:\.\d+)?$/.test(s)) {
    const value = Math.round(parseFloat(s) * multiplier * 100) / 100;
    return value === parseFloat(original) ? { value } : { value, note: `"${original}" read as ${value}` };
  }
  return { value: null, error: `"${original}" is not a number` };
}

/** Normalise a pin code to a 6-character string. Handles 570001, 570001.0, " 570 001", "570-001". */
export function parsePin(v: unknown): Parsed<string> {
  if (v === null || v === undefined || isMissing(v)) return { value: null };
  const original = asText(v);
  let s = original;
  if (typeof v === 'number') s = Number.isInteger(v) ? String(v) : String(v);
  s = s.replace(/\.0+$/, '').replace(/[\s\-]/g, '');
  if (/^\d{6}$/.test(s)) {
    return s === original ? { value: s } : { value: s, note: `pin "${original}" normalised to ${s}` };
  }
  return { value: null, error: `pin "${original}" is not a 6-digit pin code` };
}

/** Split a comma (or semicolon / newline / slash) separated pin list. */
export function parsePinList(v: unknown): { pins: string[]; invalid: string[] } {
  if (typeof v === 'number') {
    const p = parsePin(v);
    return p.value ? { pins: [p.value], invalid: [] } : { pins: [], invalid: [asText(v)] };
  }
  const parts = asText(v)
    .split(/[,;\n/|]+/)
    .map((x) => x.trim())
    .filter((x) => x && !isMissing(x));
  const pins: string[] = [];
  const invalid: string[] = [];
  for (const part of parts) {
    const p = parsePin(part);
    if (p.value) {
      if (!pins.includes(p.value)) pins.push(p.value);
    } else invalid.push(part);
  }
  return { pins, invalid };
}

function matchEnum<T extends string>(v: unknown, table: [RegExp, T][]): Parsed<T> {
  if (isMissing(v)) return { value: null };
  const original = asText(v);
  const s = original.toLowerCase();
  for (const [re, value] of table) {
    if (re.test(s)) return value.toLowerCase() === s ? { value } : { value, note: `"${original}" read as ${value}` };
  }
  return { value: null, error: `"${original}" is not a recognised value` };
}

export const parseTenure = (v: unknown): Parsed<Tenure> => {
  if (/^(none|nil|no|no space)$/i.test(asText(v))) return { value: 'Not yet identified', note: `"${asText(v)}" read as Not yet identified` };
  return matchEnum<Tenure>(v, [
    [/not\s*(yet)?\s*(identified|found|decided)|^no\b|searching|looking|^nyi$|yet to/, 'Not yet identified'],
    [/rent|leas|lease|tenan/, 'Rented'],
    [/own|self|family property|ancestral/, 'Owned'],
  ]);
};

export const parseFloor = (v: unknown) =>
  matchEnum<Floor>(v, [
    [/not\s*known|unknown|don'?t know|not sure|^nk$|tbd/, 'Not known'],
    [/mall/, 'Mall unit'],
    [/ground|^gf$|^g$|street|road\s*facing/, 'Ground'],
    [/upper|first|1st|second|2nd|third|3rd|^ff$|^sf$|basement|mezzanine/, 'Upper'],
  ]);

export const parseLanguage = (v: unknown) =>
  matchEnum<Language>(v, [
    [/kannada|^kn$|^kan$/, 'Kannada'],
    [/hindi|^hi$|^hin$/, 'Hindi'],
    [/english|^en$|^eng$/, 'English'],
  ]);

export const parsePriority = (v: unknown) =>
  matchEnum<Priority>(v, [
    [/^high|^h$|^p1$|top/, 'High'],
    [/^med|^m$|^p2$|moderate/, 'Medium'],
    [/^low|^l$|^p3$/, 'Low'],
  ]);

export const parseTier = (v: unknown) =>
  matchEnum<Tier>(v, [
    [/^(tier)?\s*-?\s*(1|i|one)$|^t1$/, 'Tier 1'],
    [/^(tier)?\s*-?\s*(2|ii|two)$|^t2$/, 'Tier 2'],
    [/^(tier)?\s*-?\s*(3|iii|three)$|^t3$/, 'Tier 3'],
  ]);

const CITY_SYNONYMS: [RegExp, string][] = [
  [/^(bengaluru|bangalore|bengaluru urban|blr|bangalore urban)$/, 'Bengaluru'],
  [/^(mysuru|mysore)$/, 'Mysuru'],
  [/^(mangaluru|mangalore)$/, 'Mangaluru'],
  [/^(hubballi[- ]?dharwad|hubli[- ]?dharwad|hubballi|hubli|dharwad|dharwar)$/, 'Hubballi-Dharwad'],
  [/^(belagavi|belgaum|belgavi)$/, 'Belagavi'],
  [/^(tumakuru|tumkur)$/, 'Tumakuru'],
  [/^(davanagere|davangere|davanagere city)$/, 'Davanagere'],
];

export function parseCity(v: unknown): Parsed<string> {
  if (isMissing(v)) return { value: null };
  const original = asText(v);
  const s = original.toLowerCase().replace(/\s+/g, ' ').replace(/\s*-\s*/g, '-');
  for (const [re, city] of CITY_SYNONYMS) {
    if (re.test(s)) return city === original ? { value: city } : { value: city, note: `"${original}" read as ${city}` };
  }
  return { value: null, error: `city "${original}" is not one of the allowed cities` };
}

export function cityForPin(pin: string | null): (typeof CITIES)[number] | null {
  if (!pin) return null;
  return CITIES.find((c) => pin.startsWith(c.prefix)) ?? null;
}

export function tierForCity(city: string | null): Tier | null {
  return CITIES.find((c) => c.city === city)?.tier ?? null;
}

export function isKarnataka(v: unknown): boolean {
  const s = asText(v).toLowerCase().replace(/[^a-z]/g, '');
  return s === 'karnataka' || s === 'ka' || s === 'karnatak';
}

// ---------- Date helpers (ISO YYYY-MM-DD strings, UTC) ----------

export function toDate(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const d = toDate(iso);
  d.setUTCDate(d.getUTCDate() + Math.round(days));
  return isoDate(d);
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((toDate(toIso).getTime() - toDate(fromIso).getTime()) / 86400000);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function fmtDate(iso: string): string {
  const d = toDate(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function fmtMonth(iso: string): string {
  const d = toDate(iso);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function fmtNum(n: number): string {
  return Number.isInteger(n) ? String(n) : round1(n).toString();
}
