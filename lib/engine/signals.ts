// Deterministic free-text signal extraction. The optional LLM extractor (lib/llm) produces the
// same shape and is passed in via input.llmSignals; this keyword version is always the fallback.

import type { ConfigValues } from '../config';
import { CITIES } from '../config';
import { addDays, toDate, isoDate, parseCity } from './normalize';
import type { Signals } from './types';

const HIGH: [RegExp, string][] = [
  [/footwear|shoe|chappal|sandal/, 'Footwear retail'],
  [/apparel|garment|cloth|textile|saree|sari|boutique|fashion|readymade/, 'Apparel / garments'],
  [/mobile|phone|cell ?shop/, 'Mobile phones & accessories'],
  [/electronic|appliance|computer shop|laptop/, 'Electronics retail'],
  [/accessor/, 'Accessories retail'],
  [/eyewear|optical|optician|spectacle|sunglass/, 'Eyewear / optical'],
  [/grocery|kirana|supermarket|provision|departmental|mart\b/, 'Grocery / kirana'],
  [/pharmacy|medical store|medical shop|chemist|druggist/, 'Pharmacy'],
  [/cosmetic|beauty product|perfume/, 'Cosmetics'],
  [/franchise owner|franchisee|run(s|ning)? a franchise|own(s)? a franchise/, 'Franchise owner'],
  [/general retail|general store|retail store|retail shop|stationery|gift shop|toy shop|jewel/, 'General retail'],
];

const MEDIUM: [RegExp, string][] = [
  [/restaurant|cafe|café|hotel|bakery|eatery|food stall|darshini|sweet/, 'Food service'],
  [/salon|parlour|parlor|spa\b|beauty/, 'Salon / services'],
  [/distribut|wholesale|dealer|stockist|trading|agency/, 'Distribution / wholesale'],
  [/sales|marketing|business development|showroom (staff|executive)/, 'Sales job'],
];

const LOW: [RegExp, string][] = [
  [/\bit\b|software|engineer|developer|tech company|infosys|wipro|tcs\b/, 'IT / office job'],
  [/office job|bank job|government job|govt|clerk|accountant|teacher|lecturer|corporate/, 'Office job'],
  [/student|fresher|graduat/, 'Student / fresher'],
  [/homemaker|housewife|house wife/, 'Homemaker'],
  [/^none$|^nil$|no business|no prior|never run|no experience|retired/, 'No business background'],
];

const GENERIC_RETAIL = /\b(shop|store|retail|outlet|showroom)\b/;

const FESTIVALS = /(diwali|deepavali|deepawali)/;

const MONTH_NAMES = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

function matchFirst(text: string, table: [RegExp, string][]): string | null {
  for (const [re, label] of table) if (re.test(text)) return label;
  return null;
}

export function extractSignals(businessText: string, notesText: string, cfg: ConfigValues, today: string): Signals {
  const business = businessText.toLowerCase();
  const notes = notesText.toLowerCase();
  const all = `${business} ${notes}`;

  let relevance: Signals['relevance'] = 'unknown';
  let businessCategory = 'Not stated';
  const high = matchFirst(business, HIGH);
  const medium = matchFirst(business, MEDIUM);
  const low = matchFirst(business, LOW);
  if (high) [relevance, businessCategory] = ['high', high];
  else if (medium) [relevance, businessCategory] = ['medium', medium];
  else if (GENERIC_RETAIL.test(business) && !low) [relevance, businessCategory] = ['high', 'General retail'];
  else if (low) [relevance, businessCategory] = ['low', low];
  else if (business.trim()) businessCategory = 'Other / unclear';

  const hiresManager = /hire (a |an )?(store )?manager|manager will (run|manage|handle)|appoint (a )?manager|through a manager|employ a manager/.test(all);
  const sideBusiness = /side business|side income|alongside (my )?(job|work)|along with (my )?(job|work)|continue (my|with my) (job|work)|keep (my )?job|weekends? only|on weekends/.test(all);
  const partTime = /part[- ]?time|few hours|evenings only/.test(all);
  const fullTime = /full[- ]?time|quit (my )?job|dedicate|leave (my )?job|resign/.test(all);
  const commitment: Signals['commitment'] = partTime || sideBusiness || hiresManager ? 'partial' : fullTime ? 'full' : 'unknown';
  const loanPending = /loan (is )?(pending|applied|awaited|approval|sanction|in process|under process)|waiting for (the |a )?(bank )?loan|applied for (a )?loan|mudra|need(s)? (a )?loan|depend(s|ing)? on (a |the )?loan|subject to loan/.test(all);
  const flexibleOnLocation = /open to (other|any|nearby|another)|flexible|any (location|city|area|pin)|can (also )?consider|willing to (move|relocate|open elsewhere|consider)|other (city|cities|area|areas|locations)|anywhere|nearby areas/.test(all);

  // Deadlines: festival names, "within N months", "by <month>"
  let mentionsDeadline = false;
  let deadlineDate: string | undefined;
  let deadlineLabel: string | undefined;
  const fest = all.match(FESTIVALS);
  if (fest && /before|by|ahead of|for|in time|during|around|on/.test(all)) {
    const next = Object.entries(cfg.festivals)
      .filter(([name]) => name.toLowerCase().startsWith('diwali'))
      .map(([name, date]) => ({ name, date }))
      .filter((f) => f.date >= today)
      .sort((x, y) => x.date.localeCompare(y.date))[0];
    if (next) {
      mentionsDeadline = true;
      deadlineDate = next.date;
      deadlineLabel = `before ${next.name}`;
    }
  }
  if (!mentionsDeadline) {
    const within = all.match(/(?:within|in|in the next|next)\s+(\d{1,2})\s*months?/);
    if (within) {
      mentionsDeadline = true;
      deadlineDate = addDays(today, parseInt(within[1], 10) * cfg.monthDays);
      deadlineLabel = `within ${within[1]} months`;
    }
  }
  if (!mentionsDeadline) {
    const by = all.match(new RegExp(`(?:by|before)\\s+(${MONTH_NAMES.join('|')})(?:\\s+(20\\d\\d))?`));
    if (by) {
      const t = toDate(today);
      const month = MONTH_NAMES.indexOf(by[1]);
      let year = by[2] ? parseInt(by[2], 10) : t.getUTCFullYear();
      if (!by[2] && month < t.getUTCMonth()) year += 1;
      mentionsDeadline = true;
      deadlineDate = isoDate(new Date(Date.UTC(year, month, 1)));
      deadlineLabel = `by ${by[1][0].toUpperCase()}${by[1].slice(1)} ${year}`;
    }
  }

  // Years of experience claimed in the free text ("running my shop for 5 years", "since 2015")
  let statedYears: number | undefined;
  const yearsMatch =
    business.match(/(\d{1,2})\+?\s*(?:years?|yrs?)/) ??
    notes.match(/(?:run|running|ran|managing|managed|worked|working|experience|own|owned)[^.]{0,40}?(\d{1,2})\+?\s*(?:years?|yrs?)/);
  if (yearsMatch) statedYears = parseInt(yearsMatch[1], 10);
  const since = all.match(/since\s+((?:19|20)\d\d)/);
  if (statedYears === undefined && since) statedYears = toDate(today).getUTCFullYear() - parseInt(since[1], 10);

  return {
    businessCategory,
    relevance,
    commitment,
    mentionsDeadline,
    deadlineDate,
    deadlineLabel,
    hiresManager,
    loanPending,
    flexibleOnLocation,
    preferredCities: mentionedCities(notes),
    sideBusiness: sideBusiness || partTime,
    statedYears,
    contradictions: [],
    method: 'deterministic',
  };
}

/** Allowed cities named in the notes (e.g. "open to Belagavi or Mysuru"), in the order mentioned. */
function mentionedCities(notes: string): string[] {
  const words = notes.split(/[^a-z-]+/).filter(Boolean);
  const found: string[] = [];
  for (let i = 0; i < words.length; i++) {
    for (const span of [words[i], `${words[i]}-${words[i + 1] ?? ''}`]) {
      const c = parseCity(span).value;
      if (c && !found.includes(c)) found.push(c);
    }
  }
  return found.filter((c) => CITIES.some((x) => x.city === c));
}
