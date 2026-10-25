// Layer 1: clean every raw row and attach validation / contradiction flags.
// Nothing here throws on bad data: problems become flags on the applicant.

import { EXISTING_STORES_DEFAULT, type ConfigValues, type Tier } from '../config';
import {
  asText,
  cityForPin,
  daysBetween,
  fmtDate,
  isKarnataka,
  isMissing,
  parseCity,
  parseFloor,
  parseLanguage,
  parseNumber,
  parsePin,
  parsePinList,
  parsePriority,
  parseTenure,
  parseTier,
  tierForCity,
} from './normalize';
import { extractSignals } from './signals';
import type { Application, CleanNote, DataIssue, Flag, RawApplication, RawStore, RawTerritory, Signals, Store, Territory } from './types';

export const FLAG_SEVERITY: Record<string, Flag['severity']> = {
  MISSING_REQUIRED: 'BLOCKING',
  PIN_INVALID: 'BLOCKING',
  STATE_NOT_KARNATAKA: 'BLOCKING',
  PIN_CITY_MISMATCH: 'BLOCKING',
  SPACE_SIZE_MISSING: 'BLOCKING',
  NEGATIVE_OR_IMPOSSIBLE_VALUE: 'BLOCKING',
  DUPLICATE_ID: 'BLOCKING',
  DUPLICATE_APPLICANT: 'BLOCKING',
  SPACE_SIZE_WITHOUT_SPACE: 'WARNING',
  SPACE_SIZE_UNCONFIRMED: 'WARNING',
  LAUNCH_UNREALISTIC: 'WARNING',
  NOTE_TIMELINE_CONFLICT: 'WARNING',
  NOTE_EXPERIENCE_CONFLICT: 'WARNING',
  CITY_UNRECOGNISED: 'WARNING',
  UNPARSEABLE_VALUE: 'WARNING',
  FLOOR_MISSING: 'INFO',
  LAUNCH_MISSING: 'INFO',
  NOTE_COMMITMENT_RISK: 'INFO',
  LANGUAGE_DEFAULTED: 'INFO',
};

function flag(code: string, message: string, field?: string, params?: Flag['params']): Flag {
  return { code, severity: FLAG_SEVERITY[code] ?? 'INFO', message, field, params };
}

const REQUIRED_LABELS: Record<string, string> = {
  applicationId: 'Application ID',
  applicantName: 'Applicant name',
  city: 'City',
  state: 'State',
  pin: 'Pin code',
  investment: 'Investment capacity',
  experience: 'Retail experience',
  spaceAvailable: 'Space available',
};

export function isBlankRow(r: RawApplication): boolean {
  return (['applicationId', 'applicantName', 'city', 'state', 'pin', 'investment', 'experience', 'business', 'spaceAvailable', 'spaceSize', 'floor', 'targetLaunch', 'language', 'notes'] as const).every(
    (k) => asText(r[k]) === '',
  );
}

export function cleanApplication(
  raw: RawApplication,
  key: string,
  cfg: ConfigValues,
  today: string,
  llmSignals?: Signals,
): Application {
  const flags: Flag[] = [];
  const cleaning: CleanNote[] = [];
  const note = (field: string, from: unknown, to: unknown, why: string) => cleaning.push({ field, from: asText(from), to: asText(to), note: why });
  const missing: string[] = [];

  const id = asText(raw.applicationId) || `ROW-${raw.rowNumber ?? '?'}`;
  if (!asText(raw.applicationId)) missing.push('applicationId');
  const name = asText(raw.applicantName);
  if (!name || isMissing(raw.applicantName)) missing.push('applicantName');

  // Pin
  const pinP = parsePin(raw.pin);
  if (pinP.note) note('Pin code', raw.pin, pinP.value, pinP.note);
  if (pinP.error) flags.push(flag('PIN_INVALID', `The pin code ${pinP.error.replace(/^pin /, '')}.`, 'pin', { raw: asText(raw.pin) }));
  else if (!pinP.value) missing.push('pin');
  const pin = pinP.value;
  const pinCity = cityForPin(pin);

  // City
  const cityP = parseCity(raw.city);
  let city: string | null = cityP.value;
  let cityRecognised = !!cityP.value;
  if (cityP.note) note('City', raw.city, cityP.value, cityP.note);
  if (!cityP.value && !cityP.error) missing.push('city');
  if (cityP.error) {
    city = pinCity?.city ?? asText(raw.city);
    cityRecognised = !!pinCity;
    flags.push(
      flag(
        'CITY_UNRECOGNISED',
        pinCity
          ? `City "${asText(raw.city)}" is not one of the allowed cities; the pin ${pin} points to ${pinCity.city}, so ${pinCity.city} is used.`
          : `City "${asText(raw.city)}" is not one of the allowed cities.`,
        'city',
        { raw: asText(raw.city) },
      ),
    );
  }
  if (cityP.value && pin && pinCity?.city !== cityP.value) {
    flags.push(
      flag(
        'PIN_CITY_MISMATCH',
        pinCity
          ? `The pin ${pin} belongs to ${pinCity.city} (pins starting ${pinCity.prefix}), but the stated city is ${cityP.value}. Ask the applicant which is correct.`
          : `The pin ${pin} does not belong to ${cityP.value} or any other allowed city. Ask the applicant to confirm the pin.`,
        'pin',
        { pin, statedCity: cityP.value, pinCity: pinCity?.city ?? 'an unlisted area' },
      ),
    );
  }

  // State
  let state: string | null = asText(raw.state) || null;
  if (!state || isMissing(raw.state)) {
    missing.push('state');
    state = null;
  } else if (!isKarnataka(raw.state)) {
    flags.push(flag('STATE_NOT_KARNATAKA', `State is "${state}"; the brand is only expanding in Karnataka.`, 'state', { state }));
  } else if (state !== 'Karnataka') {
    note('State', state, 'Karnataka', `"${state}" read as Karnataka`);
    state = 'Karnataka';
  }

  // Numbers
  const num = (field: keyof RawApplication, unit: Parameters<typeof parseNumber>[1], label: string, required: boolean) => {
    const p = parseNumber(raw[field], unit);
    if (p.note) note(label, raw[field], p.value, p.note);
    if (p.error) {
      if (required) flags.push(flag('MISSING_REQUIRED', `${label}: ${p.error}, so it cannot be used.`, String(field), { field: label }));
      else flags.push(flag('UNPARSEABLE_VALUE', `${label}: ${p.error}; treated as blank.`, String(field), { field: label }));
    } else if (p.value === null && required) missing.push(String(field));
    return p.value;
  };
  const investmentLakh = num('investment', 'lakh', 'Investment capacity', true);
  const experienceYears = num('experience', 'years', 'Retail experience', true);
  let spaceSqft = num('spaceSize', 'sqft', 'Space size', false);
  const targetLaunchMonths = num('targetLaunch', 'months', 'Target launch', false);

  const lim = cfg.impossibleValues;
  const impossible: string[] = [];
  if (investmentLakh !== null && (investmentLakh <= 0 || investmentLakh > lim.maxInvestmentLakh)) impossible.push(`investment of ${investmentLakh} lakh`);
  if (experienceYears !== null && (experienceYears < 0 || experienceYears > lim.maxExperienceYears)) impossible.push(`experience of ${experienceYears} years`);
  if (spaceSqft !== null && (spaceSqft <= 0 || spaceSqft > lim.maxSpaceSqft)) impossible.push(`space of ${spaceSqft} sq ft`);
  if (targetLaunchMonths !== null && (targetLaunchMonths < 0 || targetLaunchMonths > lim.maxTargetLaunchMonths)) impossible.push(`target launch of ${targetLaunchMonths} months`);
  if (impossible.length)
    flags.push(flag('NEGATIVE_OR_IMPOSSIBLE_VALUE', `Impossible value: ${impossible.join(', ')}. Ask the applicant to correct it.`, undefined, { values: impossible.join(', ') }));

  // Space
  const tenureP = parseTenure(raw.spaceAvailable);
  if (tenureP.note) note('Space available', raw.spaceAvailable, tenureP.value, tenureP.note);
  if (tenureP.error) flags.push(flag('MISSING_REQUIRED', `Space available: ${tenureP.error}.`, 'spaceAvailable', { field: 'Space available' }));
  else if (!tenureP.value) missing.push('spaceAvailable');
  const space = tenureP.value;
  if (space === 'Not yet identified' && spaceSqft !== null) {
    flags.push(
      flag('SPACE_SIZE_WITHOUT_SPACE', `Space is "Not yet identified" but a size of ${spaceSqft} sq ft was given. Treated as no space; the size is ignored.`, 'spaceSize', { size: spaceSqft }),
    );
    note('Space size', spaceSqft, '', 'ignored because no space has been identified');
    spaceSqft = null;
  }
  if ((space === 'Owned' || space === 'Rented') && spaceSqft === null && raw.spaceSizePending)
    flags.push(
      flag('SPACE_SIZE_UNCONFIRMED', `A ${space.toLowerCase()} space was reported in a follow-up, but its size is not confirmed yet. Approval is conditional on the size meeting the minimum.`, 'spaceSize', {
        tenure: space,
      }),
    );
  else if ((space === 'Owned' || space === 'Rented') && spaceSqft === null && !impossible.some((x) => x.startsWith('space')))
    flags.push(flag('SPACE_SIZE_MISSING', `The space is ${space.toLowerCase()} but its size is blank, so it cannot be checked against the minimum.`, 'spaceSize', { tenure: space }));

  const floorP = parseFloor(raw.floor);
  if (floorP.note) note('Floor', raw.floor, floorP.value, floorP.note);
  if (floorP.error) flags.push(flag('UNPARSEABLE_VALUE', `Floor: ${floorP.error}; treated as not known.`, 'floor', { field: 'Floor' }));
  const floor = floorP.value;
  if ((space === 'Owned' || space === 'Rented') && !floor && !floorP.error)
    flags.push(flag('FLOOR_MISSING', 'Floor of the space was not given; a site visit will confirm it.', 'floor'));

  // Language
  const langP = parseLanguage(raw.language);
  if (langP.note) note('Preferred language', raw.language, langP.value, langP.note);
  const language = langP.value ?? 'English';
  if (!langP.value) flags.push(flag('LANGUAGE_DEFAULTED', `Preferred language ${langP.error ? `"${asText(raw.language)}" not recognised` : 'blank'}; English is used.`, 'language'));

  // Launch
  const hasSpace = space === 'Owned' || space === 'Rented';
  const leadTime = hasSpace ? cfg.leadTimeMonths.withSpace : cfg.leadTimeMonths.withoutSpace;
  let effectiveLaunchMonths = targetLaunchMonths ?? cfg.defaultTargetLaunchMonths;
  if (targetLaunchMonths === null) {
    flags.push(flag('LAUNCH_MISSING', `Target launch was blank; the default of ${cfg.defaultTargetLaunchMonths} months is assumed.`, 'targetLaunch'));
  } else if (targetLaunchMonths >= 0 && targetLaunchMonths < leadTime) {
    flags.push(
      flag(
        'LAUNCH_UNREALISTIC',
        `Target launch of ${targetLaunchMonths} month${targetLaunchMonths === 1 ? '' : 's'} is shorter than the ${leadTime}-month minimum lead time ${hasSpace ? 'for a store with a space ready' : 'when no space has been found yet'}.`,
        'targetLaunch',
        { target: targetLaunchMonths, lead: leadTime },
      ),
    );
  }
  if (effectiveLaunchMonths < 0) effectiveLaunchMonths = cfg.defaultTargetLaunchMonths;

  // Free-text signals
  const business = asText(raw.business);
  const notes = asText(raw.notes);
  const signals: Signals = llmSignals ? { ...llmSignals, contradictions: [] } : extractSignals(business, notes, cfg, today);

  if (signals.mentionsDeadline && signals.deadlineDate) {
    const daysToDeadline = daysBetween(today, signals.deadlineDate);
    const monthsToDeadline = daysToDeadline / cfg.monthDays;
    const tooLateForTarget = monthsToDeadline < effectiveLaunchMonths - 0.25;
    const tooSoonForLead = monthsToDeadline < leadTime;
    if (tooLateForTarget || tooSoonForLead) {
      const why = [
        tooLateForTarget ? `the target launch is ${effectiveLaunchMonths} months away` : null,
        tooSoonForLead ? `the minimum lead time is ${leadTime} months` : null,
      ]
        .filter(Boolean)
        .join(' and ');
      const text = `Notes say "${signals.deadlineLabel}" (${fmtDate(signals.deadlineDate)}, ${daysToDeadline} days away), but ${why}.`;
      signals.contradictions.push(text);
      flags.push(
        flag('NOTE_TIMELINE_CONFLICT', `${text} Confirm which date the applicant is planning for.`, 'notes', {
          label: signals.deadlineLabel ?? '',
          date: signals.deadlineDate,
          days: daysToDeadline,
          target: effectiveLaunchMonths,
          lead: leadTime,
        }),
      );
    }
  }
  if (signals.statedYears !== undefined && experienceYears !== null) {
    const diff = Math.abs(signals.statedYears - experienceYears);
    if ((experienceYears === 0 && signals.statedYears >= 1) || diff >= 3) {
      const text = `Retail experience is given as ${experienceYears} years, but the text mentions ${signals.statedYears} years.`;
      signals.contradictions.push(text);
      flags.push(flag('NOTE_EXPERIENCE_CONFLICT', `${text} The figure in the form is used until the applicant confirms.`, 'experience', { field: experienceYears, text: signals.statedYears }));
    }
  }
  const commitmentRisks = [
    signals.sideBusiness ? 'runs it as a side business / part-time' : null,
    signals.hiresManager ? 'plans to hire a manager to run the store' : null,
    signals.loanPending ? 'funding depends on a pending loan' : null,
  ].filter(Boolean);
  if (commitmentRisks.length) flags.push(flag('NOTE_COMMITMENT_RISK', `Notes suggest the applicant ${commitmentRisks.join('; ')}.`, 'notes', { risks: commitmentRisks.join('; ') }));

  if (missing.length) {
    const labels = missing.map((m) => REQUIRED_LABELS[m] ?? m);
    flags.unshift(flag('MISSING_REQUIRED', `Required information is missing: ${labels.join(', ')}.`, missing.join(','), { fields: labels.join(', ') }));
  }

  return {
    key,
    id,
    rowNumber: raw.rowNumber ?? null,
    name: name || '(name missing)',
    city,
    cityRecognised,
    pinCity: pinCity?.city ?? null,
    state,
    pin,
    investmentLakh: impossible.some((x) => x.startsWith('investment')) ? null : investmentLakh,
    experienceYears: impossible.some((x) => x.startsWith('experience')) ? null : experienceYears,
    business,
    space,
    spaceSqft: impossible.some((x) => x.startsWith('space')) ? null : spaceSqft,
    floor,
    targetLaunchMonths,
    effectiveLaunchMonths,
    language,
    notes,
    signals,
    flags,
    cleaning,
  };
}

/** Unique key per non-blank raw row (later duplicates of an ID get "#2", "#3"...). Blank rows get null. */
export function rawKeys(raws: RawApplication[]): (string | null)[] {
  const seen = new Map<string, number>();
  let count = 0;
  return raws.map((raw) => {
    if (isBlankRow(raw)) return null;
    count++;
    const id = asText(raw.applicationId) || `ROW-${raw.rowNumber ?? count}`;
    const n = (seen.get(id) ?? 0) + 1;
    seen.set(id, n);
    return n === 1 ? id : `${id}#${n}`;
  });
}

/** Clean all application rows, assigning unique keys and flagging duplicate IDs. */
export function cleanApplications(raws: RawApplication[], cfg: ConfigValues, today: string, llmSignals?: Record<string, Signals>): Application[] {
  const keys = rawKeys(raws);
  const out: Application[] = [];
  raws.forEach((raw, i) => {
    const key = keys[i];
    if (!key) return;
    const app = cleanApplication(raw, key, cfg, today, llmSignals?.[key]);
    if (key.includes('#')) {
      app.flags.unshift(
        flag('DUPLICATE_ID', `Application ID ${app.id} is used more than once; the first row keeps it. This row (row ${raw.rowNumber ?? '?'}) is held until it gets its own ID.`, 'applicationId', { id: app.id }),
      );
    }
    out.push(app);
  });
  return out;
}

export function cleanTerritories(raws: RawTerritory[]): { territories: Territory[]; issues: DataIssue[]; pinOwner: Map<string, string> } {
  const issues: DataIssue[] = [];
  const territories: Territory[] = [];
  const pinOwner = new Map<string, string>();
  const seenIds = new Set<string>();
  raws.forEach((raw, i) => {
    const tIssues: string[] = [];
    let id = asText(raw.territoryId);
    if (!id && !asText(raw.pins)) return; // blank row
    if (!id) {
      id = `TER-ROW-${raw.rowNumber ?? i + 1}`;
      tIssues.push('Territory ID is blank; a row-based ID is used.');
    }
    if (seenIds.has(id)) {
      issues.push({ scope: 'territory', ref: id, code: 'DUPLICATE_TERRITORY', severity: 'WARNING', message: `Territory ID ${id} appears more than once; only the first row is used.` });
      return;
    }
    seenIds.add(id);
    const cityP = parseCity(raw.city);
    const { pins, invalid } = parsePinList(raw.pins);
    if (invalid.length) tIssues.push(`Ignored invalid pin codes: ${invalid.join(', ')}.`);
    const city = cityP.value ?? cityForPin(pins[0] ?? null)?.city ?? (asText(raw.city) || 'Unknown');
    if (!cityP.value) tIssues.push(`City "${asText(raw.city)}" not recognised; ${city} inferred from the pin codes.`);
    const tierP = parseTier(raw.tier);
    const mapTier = tierForCity(city);
    let tier: Tier = tierP.value ?? mapTier ?? 'Tier 2';
    if (!tierP.value) tIssues.push(`City tier "${asText(raw.tier)}" not recognised; ${tier} used from the city list.`);
    else if (mapTier && mapTier !== tierP.value) {
      tIssues.push(`City tier given as ${tierP.value}, but ${city} is ${mapTier} in the allowed values; ${mapTier} is used.`);
      tier = mapTier;
    }
    const slotsP = parseNumber(raw.openSlots, 'count');
    let openSlots = slotsP.value ?? 0;
    if (slotsP.value === null) tIssues.push(`Open slots "${asText(raw.openSlots)}" not readable; treated as 0.`);
    if (openSlots < 0 || !Number.isInteger(openSlots)) {
      tIssues.push(`Open slots ${openSlots} is not a whole number of 0 or more; ${Math.max(0, Math.floor(openSlots))} used.`);
      openSlots = Math.max(0, Math.floor(openSlots));
    }
    const prioP = parsePriority(raw.priority);
    const priority = prioP.value ?? 'Medium';
    if (!prioP.value) tIssues.push(`Priority "${asText(raw.priority)}" not recognised; Medium used.`);
    const ownPins: string[] = [];
    for (const pin of pins) {
      const pc = cityForPin(pin);
      if (pc && pc.city !== city) tIssues.push(`Pin ${pin} belongs to ${pc.city}, not ${city}; kept as listed.`);
      const owner = pinOwner.get(pin);
      if (owner) {
        issues.push({ scope: 'territory', ref: id, code: 'TERRITORY_OVERLAP', severity: 'WARNING', message: `Pin ${pin} is listed in both ${owner} and ${id}; it is assigned to ${owner} (the first).` });
        tIssues.push(`Pin ${pin} also belongs to ${owner}; assigned to ${owner}.`);
        continue;
      }
      pinOwner.set(pin, id);
      ownPins.push(pin);
    }
    if (!isKarnataka(raw.state) && asText(raw.state)) tIssues.push(`State "${asText(raw.state)}" is not Karnataka.`);
    for (const t of tIssues) if (!t.includes('also belongs to')) issues.push({ scope: 'territory', ref: id, code: 'TERRITORY_DATA', severity: 'INFO', message: t });
    territories.push({ id, rowNumber: raw.rowNumber ?? null, city, state: 'Karnataka', pins: ownPins, tier, openSlots, priority, issues: tIssues });
  });
  return { territories, issues, pinOwner };
}

export function cleanStores(raws: RawStore[] | undefined): { stores: Store[]; issues: DataIssue[] } {
  const issues: DataIssue[] = [];
  const source = raws && raws.length ? raws : EXISTING_STORES_DEFAULT;
  const stores: Store[] = [];
  for (const raw of source as RawStore[]) {
    const pinP = parsePin(raw.pin);
    if (!pinP.value) {
      if (asText(raw.storeId)) issues.push({ scope: 'store', ref: asText(raw.storeId), code: 'STORE_PIN_INVALID', severity: 'WARNING', message: `Existing store ${asText(raw.storeId)} has an unreadable pin "${asText(raw.pin)}"; ignored.` });
      continue;
    }
    const year = parseNumber(raw.openedYear, 'count').value ?? 2020;
    const cityP = parseCity(raw.city);
    stores.push({ storeId: asText(raw.storeId) || `ST-${pinP.value}`, city: cityP.value ?? cityForPin(pinP.value)?.city ?? asText(raw.city), pin: pinP.value, openedYear: year });
  }
  if (!raws || !raws.length) issues.push({ scope: 'file', ref: 'Existing stores', code: 'STORES_DEFAULTED', severity: 'INFO', message: 'No Existing stores sheet was found; the fixed list of 10 stores from the case brief is used.' });
  return { stores, issues };
}
