// Applicant-facing messages in English, Kannada and Hindi. Deterministic templates filled with
// the applicant's facts. No internal reason codes or scores (only the waitlist position).
// Kannada and Hindi templates should be reviewed by a native speaker.

import type { ConfigValues } from '../config';
import { rankOnceCleared } from './rank';
import { isApproved, type Work } from './decide';
import { toDate } from './normalize';
import type { Counterfactual, Language, Redirect } from './types';

type P = Record<string, string | number | undefined>;

interface Dict {
  date: (iso: string) => string;
  by: (date: string) => string;
  city: Record<string, string>;
  greet: (name: string) => string;
  sign: string;
  approved: (p: P) => string;
  approvedCond: (p: P) => string;
  reserved: (p: P) => string;
  condIntro: string;
  steps: string;
  step1: string;
  step2: string;
  step3: string;
  docs: (spaceProof: string) => string;
  rentProof: string;
  ownProof: string;
  training: string;
  hold: (p: P) => string;
  howToSend: (p: P) => string;
  afterHoldRank: (p: P) => string;
  afterHold: string;
  waitlisted: (p: P) => string;
  waitNext: string;
  rejected: (p: P) => string;
  reapply: string;
  redirectIntro: string;
  redirect: (p: P) => string;
  withdrawn: (p: P) => string;
  ask: Record<string, (p: P) => string>;
  reason: Record<string, (p: P) => string>;
  area: Record<string, string>;
}

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const numDate = (iso: string) => {
  const d = toDate(iso);
  return `${String(d.getUTCDate()).padStart(2, '0')}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${d.getUTCFullYear()}`;
};

const EN: Dict = {
  date: (iso) => {
    const d = toDate(iso);
    return `${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  },
  by: (dt) => `reply by ${dt}`,
  city: {},
  greet: (n) => `Dear ${n},`,
  sign: 'Regards,\nFranchise Expansion Team',
  approved: (p) => `Congratulations! Your application ${p.id} for a franchise store in ${p.city} (pin ${p.pin}) has been approved.`,
  approvedCond: (p) => `Congratulations! Your application ${p.id} for a franchise store in ${p.city} (pin ${p.pin}) has been approved, subject to a few points we need to confirm with you.`,
  reserved: (p) => `We have reserved this location for you until ${p.deadline}. To keep it, please sign the franchise agreement and confirm your shop space by then.`,
  condIntro: 'Before we sign the agreement, please confirm:',
  steps: 'Your first three steps:',
  step1: '1. Sign the franchise agreement and complete KYC.',
  step2: '2. Our team visits your space to verify it.',
  step3: '3. Plan the shop fit-out and signage with our design team.',
  docs: (sp) => `Please keep these documents ready: ID proof, address proof, PAN card, ${sp}, and bank account details.`,
  rentProof: 'the rental agreement for the shop',
  ownProof: 'the ownership document for the shop',
  training: 'Your training will be conducted in English.',
  hold: (p) => `Thank you for applying (application ${p.id}). Your application is on hold until we receive the following:`,
  howToSend: (p) => `Please reply to this message with these details (photos of documents are fine) by ${p.deadline}.`,
  afterHoldRank: (p) => `Once we receive them, your application would be ranked #${p.rank} for the ${p.slots} open slot${Number(p.slots) === 1 ? '' : 's'} in ${p.city}.`,
  afterHold: 'Once we receive them, we will review your application again within two working days.',
  waitlisted: (p) => `Thank you for applying (application ${p.id}). Your application is on our waitlist for ${p.city}, at position ${p.pos}.`,
  waitNext: 'If a slot opens up, we will contact you straight away.',
  rejected: (p) => `Thank you for your interest in our franchise. Unfortunately we cannot take your application ${p.id} forward as it stands.`,
  reapply: 'You are welcome to apply again if your plans change.',
  redirectIntro: 'There is another option:',
  redirect: (p) => `We have an open slot in ${p.city} (pin code${String(p.pins).includes(',') ? 's' : ''} ${p.pins}). If you can find a shop space there, we can consider you right away. Reply if you are interested.`,
  withdrawn: (p) => `We have recorded that you have withdrawn application ${p.id}. Thank you for your interest; you are welcome to apply again at any time.`,
  ask: {
    SPACE_NOT_IDENTIFIED: (p) => `A shop space of at least ${p.min} sq ft in or near pin ${p.pin}: send its address, size, floor, and whether it is owned or rented.`,
    SPACE_SIZE_MISSING: () => 'The size of your shop space in sq ft.',
    SPACE_SIZE_UNCONFIRMED: (p) => `The size of your new shop space in sq ft (it must be at least ${p.min} sq ft).`,
    SPACE_TOO_SMALL: (p) => `A larger space: yours is ${p.size} sq ft and the minimum is ${p.min} sq ft.`,
    CAPITAL_SHORTFALL_SMALL: (p) => `Proof of investment capacity of ₹${p.min} lakh (you mentioned ₹${p.inv} lakh, a gap of ₹${p.gap} lakh), for example a bank statement or a loan sanction letter.`,
    PIN_CITY_MISMATCH: (p) => `Confirmation of the store location: pin ${p.pin} is in ${p.pinCity}, but the application says ${p.statedCity}.`,
    PIN_INVALID: () => 'A valid 6-digit pin code for the store location.',
    MISSING_REQUIRED: (p) => `The missing details: ${p.fields}.`,
    STATE_NOT_KARNATAKA: () => 'Confirmation that the store will be in Karnataka.',
    NEGATIVE_OR_IMPOSSIBLE_VALUE: (p) => `A correction: ${p.values}.`,
    DUPLICATE_ID: () => 'Confirmation of your application: we received two forms with the same application number.',
    DUPLICATE_APPLICANT: () => 'Confirmation that this is a separate application: we received two applications with your name and pin code.',
    LAUNCH_UNREALISTIC: (p) => `Your planned opening date: ${p.target} month(s) is shorter than the ${p.lead} months a new store usually needs.`,
    NOTE_TIMELINE_CONFLICT: (p) => `Your planned opening date: you mentioned "${p.label}" (${p.date}), which does not fit the time a new store needs.`,
    NOTE_EXPERIENCE_CONFLICT: (p) => `Your years of retail experience: the form says ${p.field} but your description mentions ${p.text}.`,
    NEAR_MISS: (p) => `Anything that strengthens your application, for example ${p.fix}.`,
    RESERVATION_EXPIRED: () => 'Confirmation that you still want to go ahead; your reservation lapsed because the agreement was not signed in time.',
    CITY_UNRECOGNISED: (p) => `Confirmation of the city (you wrote "${p.raw}").`,
    UNPARSEABLE_VALUE: (p) => `The ${p.field}, which we could not read.`,
  },
  reason: {
    PIN_TAKEN_BY_HIGHER_RANK: (p) => `Another applicant has been selected for pin ${p.pin}, and we open only one store per pin code.`,
    SLOTS_FULL: () => 'All open slots in your area have been taken for now.',
    NO_SLOTS: () => 'We are not opening new stores in your area right now.',
    RELEASED_BY_OVERRIDE: () => 'Your reserved slot has been reassigned by our team.',
    OUTSIDE_TERRITORIES: (p) => `We are not opening stores in pin ${p.pin} at the moment.`,
    PIN_HAS_STORE: (p) => `We already have a store in pin ${p.pin}, and we open only one store per pin code.`,
    CAPITAL_INSUFFICIENT: (p) => `The minimum investment for a store in ${p.city} is ₹${p.min} lakh, and the amount in your application is well below that.`,
    SCORE_BELOW_BAR: (p) => `Your application does not meet our current criteria, mainly on ${p.area}.`,
    OTHER: () => 'Your application does not meet our current criteria.',
  },
  area: { financial: 'investment capacity', operator: 'retail experience', site: 'the shop space', launch: 'the opening timeline', territory: 'location' },
};

const KN: Dict = {
  date: numDate,
  by: (dt) => `${dt} ರೊಳಗೆ ತಿಳಿಸಿ`,
  city: { Bengaluru: 'ಬೆಂಗಳೂರು', Mysuru: 'ಮೈಸೂರು', Mangaluru: 'ಮಂಗಳೂರು', 'Hubballi-Dharwad': 'ಹುಬ್ಬಳ್ಳಿ-ಧಾರವಾಡ', Belagavi: 'ಬೆಳಗಾವಿ', Tumakuru: 'ತುಮಕೂರು', Davanagere: 'ದಾವಣಗೆರೆ' },
  greet: (n) => `ಆತ್ಮೀಯ ${n} ಅವರೇ,`,
  sign: 'ವಂದನೆಗಳೊಂದಿಗೆ,\nಫ್ರಾಂಚೈಸಿ ವಿಸ್ತರಣಾ ತಂಡ',
  approved: (p) => `ಅಭಿನಂದನೆಗಳು! ${p.city} ನಲ್ಲಿ (ಪಿನ್ ${p.pin}) ಫ್ರಾಂಚೈಸಿ ಮಳಿಗೆಗಾಗಿ ನಿಮ್ಮ ಅರ್ಜಿ ${p.id} ಅನುಮೋದನೆಗೊಂಡಿದೆ.`,
  approvedCond: (p) => `ಅಭಿನಂದನೆಗಳು! ${p.city} ನಲ್ಲಿ (ಪಿನ್ ${p.pin}) ಫ್ರಾಂಚೈಸಿ ಮಳಿಗೆಗಾಗಿ ನಿಮ್ಮ ಅರ್ಜಿ ${p.id} ಅನುಮೋದನೆಗೊಂಡಿದೆ. ಕೆಲವು ಅಂಶಗಳನ್ನು ನಿಮ್ಮೊಂದಿಗೆ ದೃಢಪಡಿಸಬೇಕಾಗಿದೆ.`,
  reserved: (p) => `ಈ ಸ್ಥಳವನ್ನು ${p.deadline} ರವರೆಗೆ ನಿಮಗಾಗಿ ಕಾಯ್ದಿರಿಸಲಾಗಿದೆ. ಅದನ್ನು ಉಳಿಸಿಕೊಳ್ಳಲು, ಅಷ್ಟರೊಳಗೆ ಫ್ರಾಂಚೈಸಿ ಒಪ್ಪಂದಕ್ಕೆ ಸಹಿ ಮಾಡಿ ಮತ್ತು ನಿಮ್ಮ ಅಂಗಡಿ ಜಾಗವನ್ನು ದೃಢೀಕರಿಸಿ.`,
  condIntro: 'ಒಪ್ಪಂದಕ್ಕೆ ಸಹಿ ಮಾಡುವ ಮೊದಲು ದಯವಿಟ್ಟು ಇವುಗಳನ್ನು ದೃಢಪಡಿಸಿ:',
  steps: 'ನಿಮ್ಮ ಮೊದಲ ಮೂರು ಹಂತಗಳು:',
  step1: '1. ಫ್ರಾಂಚೈಸಿ ಒಪ್ಪಂದಕ್ಕೆ ಸಹಿ ಮಾಡಿ ಮತ್ತು KYC ಪೂರ್ಣಗೊಳಿಸಿ.',
  step2: '2. ನಮ್ಮ ತಂಡ ನಿಮ್ಮ ಜಾಗವನ್ನು ಪರಿಶೀಲಿಸಲು ಭೇಟಿ ನೀಡುತ್ತದೆ.',
  step3: '3. ನಮ್ಮ ವಿನ್ಯಾಸ ತಂಡದೊಂದಿಗೆ ಅಂಗಡಿಯ ಒಳಾಂಗಣ ಮತ್ತು ನಾಮಫಲಕದ ಯೋಜನೆ ಮಾಡಿ.',
  docs: (sp) => `ದಯವಿಟ್ಟು ಈ ದಾಖಲೆಗಳನ್ನು ಸಿದ್ಧವಾಗಿಡಿ: ಗುರುತಿನ ಪುರಾವೆ, ವಿಳಾಸದ ಪುರಾವೆ, PAN ಕಾರ್ಡ್, ${sp}, ಮತ್ತು ಬ್ಯಾಂಕ್ ಖಾತೆಯ ವಿವರಗಳು.`,
  rentProof: 'ಅಂಗಡಿಯ ಬಾಡಿಗೆ ಒಪ್ಪಂದ',
  ownProof: 'ಅಂಗಡಿಯ ಮಾಲೀಕತ್ವದ ದಾಖಲೆ',
  training: 'ನಿಮ್ಮ ತರಬೇತಿಯನ್ನು ಕನ್ನಡದಲ್ಲಿ ನೀಡಲಾಗುವುದು.',
  hold: (p) => `ಅರ್ಜಿ ಸಲ್ಲಿಸಿದ್ದಕ್ಕೆ ಧನ್ಯವಾದಗಳು (ಅರ್ಜಿ ${p.id}). ಕೆಳಗಿನ ಮಾಹಿತಿ ಬರುವವರೆಗೆ ನಿಮ್ಮ ಅರ್ಜಿಯನ್ನು ತಡೆಹಿಡಿಯಲಾಗಿದೆ:`,
  howToSend: (p) => `ದಯವಿಟ್ಟು ಈ ವಿವರಗಳನ್ನು (ದಾಖಲೆಗಳ ಫೋಟೋ ಸಾಕು) ${p.deadline} ರೊಳಗೆ ಈ ಸಂದೇಶಕ್ಕೆ ಉತ್ತರವಾಗಿ ಕಳುಹಿಸಿ.`,
  afterHoldRank: (p) => `ಅವು ನಮಗೆ ತಲುಪಿದ ನಂತರ, ${p.city} ನಲ್ಲಿರುವ ${p.slots} ಖಾಲಿ ಸ್ಥಾನಗಳಿಗೆ ನಿಮ್ಮ ಅರ್ಜಿ #${p.rank} ಸ್ಥಾನದಲ್ಲಿರುತ್ತದೆ.`,
  afterHold: 'ಅವು ನಮಗೆ ತಲುಪಿದ ನಂತರ, ಎರಡು ಕೆಲಸದ ದಿನಗಳಲ್ಲಿ ನಿಮ್ಮ ಅರ್ಜಿಯನ್ನು ಮತ್ತೆ ಪರಿಶೀಲಿಸುತ್ತೇವೆ.',
  waitlisted: (p) => `ಅರ್ಜಿ ಸಲ್ಲಿಸಿದ್ದಕ್ಕೆ ಧನ್ಯವಾದಗಳು (ಅರ್ಜಿ ${p.id}). ${p.city} ಗಾಗಿ ನಮ್ಮ ಕಾಯುವ ಪಟ್ಟಿಯಲ್ಲಿ ನಿಮ್ಮ ಅರ್ಜಿ ${p.pos} ನೇ ಸ್ಥಾನದಲ್ಲಿದೆ.`,
  waitNext: 'ಸ್ಥಾನ ಖಾಲಿಯಾದ ತಕ್ಷಣ ನಾವು ನಿಮ್ಮನ್ನು ಸಂಪರ್ಕಿಸುತ್ತೇವೆ.',
  rejected: (p) => `ನಮ್ಮ ಫ್ರಾಂಚೈಸಿಯಲ್ಲಿ ಆಸಕ್ತಿ ತೋರಿದ್ದಕ್ಕೆ ಧನ್ಯವಾದಗಳು. ದುರದೃಷ್ಟವಶಾತ್, ಈಗಿರುವ ರೂಪದಲ್ಲಿ ನಿಮ್ಮ ಅರ್ಜಿ ${p.id} ಅನ್ನು ಮುಂದುವರಿಸಲು ಸಾಧ್ಯವಿಲ್ಲ.`,
  reapply: 'ನಿಮ್ಮ ಯೋಜನೆಗಳು ಬದಲಾದರೆ ಮತ್ತೆ ಅರ್ಜಿ ಸಲ್ಲಿಸಲು ಸ್ವಾಗತ.',
  redirectIntro: 'ಇನ್ನೊಂದು ಅವಕಾಶವಿದೆ:',
  redirect: (p) => `${p.city} ನಲ್ಲಿ (ಪಿನ್ ಕೋಡ್ ${p.pins}) ನಮಗೆ ಖಾಲಿ ಸ್ಥಾನವಿದೆ. ಅಲ್ಲಿ ನಿಮಗೆ ಅಂಗಡಿ ಜಾಗ ಸಿಕ್ಕರೆ, ತಕ್ಷಣ ನಿಮ್ಮನ್ನು ಪರಿಗಣಿಸಬಹುದು. ಆಸಕ್ತಿ ಇದ್ದರೆ ಉತ್ತರಿಸಿ.`,
  withdrawn: (p) => `ನೀವು ಅರ್ಜಿ ${p.id} ಅನ್ನು ಹಿಂಪಡೆದಿರುವುದನ್ನು ನಾವು ದಾಖಲಿಸಿದ್ದೇವೆ. ನಿಮ್ಮ ಆಸಕ್ತಿಗೆ ಧನ್ಯವಾದಗಳು; ಯಾವಾಗ ಬೇಕಾದರೂ ಮತ್ತೆ ಅರ್ಜಿ ಸಲ್ಲಿಸಬಹುದು.`,
  ask: {
    SPACE_NOT_IDENTIFIED: (p) => `ಪಿನ್ ${p.pin} ನಲ್ಲಿ ಅಥವಾ ಹತ್ತಿರ ಕನಿಷ್ಠ ${p.min} ಚದರ ಅಡಿ ಅಂಗಡಿ ಜಾಗ: ಅದರ ವಿಳಾಸ, ಅಳತೆ, ಮಹಡಿ, ಮತ್ತು ಅದು ಸ್ವಂತವೇ ಅಥವಾ ಬಾಡಿಗೆಯೇ ಎಂದು ತಿಳಿಸಿ.`,
    SPACE_SIZE_MISSING: () => 'ನಿಮ್ಮ ಅಂಗಡಿ ಜಾಗದ ಅಳತೆ (ಚದರ ಅಡಿಗಳಲ್ಲಿ).',
    SPACE_SIZE_UNCONFIRMED: (p) => `ನಿಮ್ಮ ಹೊಸ ಅಂಗಡಿ ಜಾಗದ ಅಳತೆ (ಕನಿಷ್ಠ ${p.min} ಚದರ ಅಡಿ ಇರಬೇಕು).`,
    SPACE_TOO_SMALL: (p) => `ದೊಡ್ಡ ಜಾಗ: ನಿಮ್ಮ ಜಾಗ ${p.size} ಚದರ ಅಡಿ, ಕನಿಷ್ಠ ${p.min} ಚದರ ಅಡಿ ಬೇಕು.`,
    CAPITAL_SHORTFALL_SMALL: (p) => `₹${p.min} ಲಕ್ಷ ಹೂಡಿಕೆ ಸಾಮರ್ಥ್ಯದ ಪುರಾವೆ (ನೀವು ₹${p.inv} ಲಕ್ಷ ಎಂದು ತಿಳಿಸಿದ್ದೀರಿ, ₹${p.gap} ಲಕ್ಷ ಕೊರತೆ), ಉದಾಹರಣೆಗೆ ಬ್ಯಾಂಕ್ ಸ್ಟೇಟ್‌ಮೆಂಟ್ ಅಥವಾ ಸಾಲ ಮಂಜೂರಾತಿ ಪತ್ರ.`,
    PIN_CITY_MISMATCH: (p) => `ಮಳಿಗೆಯ ಸ್ಥಳದ ದೃಢೀಕರಣ: ಪಿನ್ ${p.pin} ${p.pinCity} ನಲ್ಲಿದೆ, ಆದರೆ ಅರ್ಜಿಯಲ್ಲಿ ${p.statedCity} ಎಂದಿದೆ.`,
    PIN_INVALID: () => 'ಮಳಿಗೆಯ ಸ್ಥಳಕ್ಕೆ ಸರಿಯಾದ 6 ಅಂಕಿಯ ಪಿನ್ ಕೋಡ್.',
    MISSING_REQUIRED: (p) => `ಕಾಣೆಯಾದ ವಿವರಗಳು: ${p.fields}.`,
    STATE_NOT_KARNATAKA: () => 'ಮಳಿಗೆ ಕರ್ನಾಟಕದಲ್ಲಿರುತ್ತದೆ ಎಂಬ ದೃಢೀಕರಣ.',
    NEGATIVE_OR_IMPOSSIBLE_VALUE: (p) => `ಈ ಮಾಹಿತಿಯ ತಿದ್ದುಪಡಿ: ${p.values}.`,
    DUPLICATE_ID: () => 'ನಿಮ್ಮ ಅರ್ಜಿಯ ದೃಢೀಕರಣ: ಒಂದೇ ಅರ್ಜಿ ಸಂಖ್ಯೆಯೊಂದಿಗೆ ಎರಡು ಅರ್ಜಿಗಳು ಬಂದಿವೆ.',
    DUPLICATE_APPLICANT: () => 'ಇದು ಪ್ರತ್ಯೇಕ ಅರ್ಜಿ ಎಂಬ ದೃಢೀಕರಣ: ನಿಮ್ಮ ಹೆಸರು ಮತ್ತು ಪಿನ್ ಕೋಡ್‌ನೊಂದಿಗೆ ಎರಡು ಅರ್ಜಿಗಳು ಬಂದಿವೆ.',
    LAUNCH_UNREALISTIC: (p) => `ನೀವು ಯೋಜಿಸಿರುವ ಆರಂಭದ ದಿನಾಂಕ: ${p.target} ತಿಂಗಳು, ಹೊಸ ಮಳಿಗೆಗೆ ಸಾಮಾನ್ಯವಾಗಿ ಬೇಕಾಗುವ ${p.lead} ತಿಂಗಳಿಗಿಂತ ಕಡಿಮೆ.`,
    NOTE_TIMELINE_CONFLICT: (p) => `ನೀವು ಯೋಜಿಸಿರುವ ಆರಂಭದ ದಿನಾಂಕ: ನೀವು "${p.label}" (${p.date}) ಎಂದು ತಿಳಿಸಿದ್ದೀರಿ, ಅದು ಹೊಸ ಮಳಿಗೆಗೆ ಬೇಕಾಗುವ ಸಮಯಕ್ಕೆ ಹೊಂದುವುದಿಲ್ಲ.`,
    NOTE_EXPERIENCE_CONFLICT: (p) => `ನಿಮ್ಮ ಚಿಲ್ಲರೆ ವ್ಯಾಪಾರದ ಅನುಭವದ ವರ್ಷಗಳು: ಅರ್ಜಿಯಲ್ಲಿ ${p.field} ಎಂದಿದೆ, ಆದರೆ ನಿಮ್ಮ ವಿವರಣೆಯಲ್ಲಿ ${p.text} ಎಂದಿದೆ.`,
    NEAR_MISS: (p) => `ನಿಮ್ಮ ಅರ್ಜಿಯನ್ನು ಬಲಪಡಿಸುವ ಯಾವುದೇ ಮಾಹಿತಿ, ಉದಾಹರಣೆಗೆ ${p.fix}.`,
    RESERVATION_EXPIRED: () => 'ನೀವು ಇನ್ನೂ ಮುಂದುವರಿಯಲು ಬಯಸುತ್ತೀರಾ ಎಂಬ ದೃಢೀಕರಣ; ಒಪ್ಪಂದಕ್ಕೆ ಸಮಯಕ್ಕೆ ಸಹಿ ಆಗದ ಕಾರಣ ನಿಮ್ಮ ಕಾಯ್ದಿರಿಸುವಿಕೆ ರದ್ದಾಗಿದೆ.',
    CITY_UNRECOGNISED: (p) => `ನಗರದ ದೃಢೀಕರಣ (ನೀವು "${p.raw}" ಎಂದು ಬರೆದಿದ್ದೀರಿ).`,
    UNPARSEABLE_VALUE: (p) => `ನಮಗೆ ಓದಲಾಗದ ${p.field} ಮಾಹಿತಿ.`,
  },
  reason: {
    PIN_TAKEN_BY_HIGHER_RANK: (p) => `ಪಿನ್ ${p.pin} ಗಾಗಿ ಬೇರೊಬ್ಬ ಅರ್ಜಿದಾರರನ್ನು ಆಯ್ಕೆ ಮಾಡಲಾಗಿದೆ; ಒಂದು ಪಿನ್ ಕೋಡ್‌ನಲ್ಲಿ ನಾವು ಒಂದೇ ಮಳಿಗೆ ತೆರೆಯುತ್ತೇವೆ.`,
    SLOTS_FULL: () => 'ನಿಮ್ಮ ಪ್ರದೇಶದ ಎಲ್ಲಾ ಖಾಲಿ ಸ್ಥಾನಗಳು ಸದ್ಯಕ್ಕೆ ಭರ್ತಿಯಾಗಿವೆ.',
    NO_SLOTS: () => 'ಸದ್ಯಕ್ಕೆ ನಿಮ್ಮ ಪ್ರದೇಶದಲ್ಲಿ ಹೊಸ ಮಳಿಗೆಗಳನ್ನು ತೆರೆಯುತ್ತಿಲ್ಲ.',
    RELEASED_BY_OVERRIDE: () => 'ನಿಮಗಾಗಿ ಕಾಯ್ದಿರಿಸಿದ್ದ ಸ್ಥಾನವನ್ನು ನಮ್ಮ ತಂಡ ಬೇರೆಯವರಿಗೆ ನೀಡಿದೆ.',
    OUTSIDE_TERRITORIES: (p) => `ಸದ್ಯಕ್ಕೆ ಪಿನ್ ${p.pin} ನಲ್ಲಿ ನಾವು ಮಳಿಗೆಗಳನ್ನು ತೆರೆಯುತ್ತಿಲ್ಲ.`,
    PIN_HAS_STORE: (p) => `ಪಿನ್ ${p.pin} ನಲ್ಲಿ ಈಗಾಗಲೇ ನಮ್ಮ ಮಳಿಗೆ ಇದೆ; ಒಂದು ಪಿನ್ ಕೋಡ್‌ನಲ್ಲಿ ನಾವು ಒಂದೇ ಮಳಿಗೆ ತೆರೆಯುತ್ತೇವೆ.`,
    CAPITAL_INSUFFICIENT: (p) => `${p.city} ನಲ್ಲಿ ಮಳಿಗೆಗೆ ಕನಿಷ್ಠ ಹೂಡಿಕೆ ₹${p.min} ಲಕ್ಷ; ನಿಮ್ಮ ಅರ್ಜಿಯಲ್ಲಿನ ಮೊತ್ತ ಅದಕ್ಕಿಂತ ಬಹಳ ಕಡಿಮೆ ಇದೆ.`,
    SCORE_BELOW_BAR: (p) => `ನಿಮ್ಮ ಅರ್ಜಿ ನಮ್ಮ ಪ್ರಸ್ತುತ ಮಾನದಂಡಗಳನ್ನು ಪೂರೈಸುವುದಿಲ್ಲ, ಮುಖ್ಯವಾಗಿ ${p.area} ವಿಷಯದಲ್ಲಿ.`,
    OTHER: () => 'ನಿಮ್ಮ ಅರ್ಜಿ ನಮ್ಮ ಪ್ರಸ್ತುತ ಮಾನದಂಡಗಳನ್ನು ಪೂರೈಸುವುದಿಲ್ಲ.',
  },
  area: { financial: 'ಹೂಡಿಕೆ ಸಾಮರ್ಥ್ಯದ', operator: 'ಚಿಲ್ಲರೆ ವ್ಯಾಪಾರದ ಅನುಭವದ', site: 'ಅಂಗಡಿ ಜಾಗದ', launch: 'ಆರಂಭದ ಸಮಯದ', territory: 'ಸ್ಥಳದ' },
};

const HI: Dict = {
  date: numDate,
  by: (dt) => `${dt} तक बताएँ`,
  city: { Bengaluru: 'बेंगलुरु', Mysuru: 'मैसूरु', Mangaluru: 'मंगलुरु', 'Hubballi-Dharwad': 'हुब्बल्ली-धारवाड़', Belagavi: 'बेलगावी', Tumakuru: 'तुमकुरु', Davanagere: 'दावणगेरे' },
  greet: (n) => `प्रिय ${n} जी,`,
  sign: 'सादर,\nफ्रैंचाइज़ी विस्तार टीम',
  approved: (p) => `बधाई हो! ${p.city} (पिन ${p.pin}) में फ्रैंचाइज़ी स्टोर के लिए आपका आवेदन ${p.id} स्वीकृत हो गया है।`,
  approvedCond: (p) => `बधाई हो! ${p.city} (पिन ${p.pin}) में फ्रैंचाइज़ी स्टोर के लिए आपका आवेदन ${p.id} स्वीकृत हो गया है, कुछ बातों की पुष्टि के अधीन।`,
  reserved: (p) => `हमने यह स्थान ${p.deadline} तक आपके लिए आरक्षित रखा है। इसे बनाए रखने के लिए कृपया तब तक फ्रैंचाइज़ी अनुबंध पर हस्ताक्षर करें और अपनी दुकान की जगह की पुष्टि करें।`,
  condIntro: 'अनुबंध पर हस्ताक्षर से पहले कृपया इनकी पुष्टि करें:',
  steps: 'आपके पहले तीन कदम:',
  step1: '1. फ्रैंचाइज़ी अनुबंध पर हस्ताक्षर करें और KYC पूरा करें।',
  step2: '2. हमारी टीम आपकी जगह की जाँच के लिए आएगी।',
  step3: '3. हमारी डिज़ाइन टीम के साथ दुकान की साज-सज्जा और साइनबोर्ड की योजना बनाएँ।',
  docs: (sp) => `कृपया ये दस्तावेज़ तैयार रखें: पहचान प्रमाण, पते का प्रमाण, पैन कार्ड, ${sp}, और बैंक खाते का विवरण।`,
  rentProof: 'दुकान का किराया अनुबंध',
  ownProof: 'दुकान के स्वामित्व का दस्तावेज़',
  training: 'आपका प्रशिक्षण हिंदी में होगा।',
  hold: (p) => `आवेदन करने के लिए धन्यवाद (आवेदन ${p.id})। नीचे दी गई जानकारी मिलने तक आपका आवेदन रोका गया है:`,
  howToSend: (p) => `कृपया ये विवरण (दस्तावेज़ों की फ़ोटो भी चलेगी) ${p.deadline} तक इस संदेश के जवाब में भेजें।`,
  afterHoldRank: (p) => `जानकारी मिलने के बाद, ${p.city} की ${p.slots} खाली जगहों के लिए आपका आवेदन #${p.rank} स्थान पर होगा।`,
  afterHold: 'जानकारी मिलने के बाद हम दो कार्य दिवसों में आपके आवेदन की फिर से समीक्षा करेंगे।',
  waitlisted: (p) => `आवेदन करने के लिए धन्यवाद (आवेदन ${p.id})। ${p.city} के लिए हमारी प्रतीक्षा सूची में आपका आवेदन ${p.pos} स्थान पर है।`,
  waitNext: 'जगह खाली होते ही हम आपसे तुरंत संपर्क करेंगे।',
  rejected: (p) => `हमारी फ्रैंचाइज़ी में रुचि दिखाने के लिए धन्यवाद। खेद है कि वर्तमान रूप में हम आपका आवेदन ${p.id} आगे नहीं बढ़ा सकते।`,
  reapply: 'अगर आपकी योजना बदलती है तो आप फिर से आवेदन कर सकते हैं।',
  redirectIntro: 'एक और विकल्प है:',
  redirect: (p) => `${p.city} (पिन कोड ${p.pins}) में हमारे पास एक खाली जगह है। अगर आपको वहाँ दुकान की जगह मिल सकती है, तो हम आप पर तुरंत विचार कर सकते हैं। रुचि हो तो जवाब दें।`,
  withdrawn: (p) => `हमने दर्ज कर लिया है कि आपने आवेदन ${p.id} वापस ले लिया है। आपकी रुचि के लिए धन्यवाद; आप कभी भी फिर से आवेदन कर सकते हैं।`,
  ask: {
    SPACE_NOT_IDENTIFIED: (p) => `पिन ${p.pin} में या उसके पास कम से कम ${p.min} वर्ग फुट की दुकान: उसका पता, आकार, मंज़िल, और वह अपनी है या किराये की, यह बताएँ।`,
    SPACE_SIZE_MISSING: () => 'आपकी दुकान की जगह का आकार (वर्ग फुट में)।',
    SPACE_SIZE_UNCONFIRMED: (p) => `आपकी नई दुकान की जगह का आकार (कम से कम ${p.min} वर्ग फुट होना चाहिए)।`,
    SPACE_TOO_SMALL: (p) => `बड़ी जगह: आपकी जगह ${p.size} वर्ग फुट है और न्यूनतम ${p.min} वर्ग फुट चाहिए।`,
    CAPITAL_SHORTFALL_SMALL: (p) => `₹${p.min} लाख निवेश क्षमता का प्रमाण (आपने ₹${p.inv} लाख बताया है, ₹${p.gap} लाख की कमी), जैसे बैंक स्टेटमेंट या ऋण स्वीकृति पत्र।`,
    PIN_CITY_MISMATCH: (p) => `स्टोर के स्थान की पुष्टि: पिन ${p.pin} ${p.pinCity} में है, लेकिन आवेदन में ${p.statedCity} लिखा है।`,
    PIN_INVALID: () => 'स्टोर के स्थान का सही 6 अंकों का पिन कोड।',
    MISSING_REQUIRED: (p) => `छूटी हुई जानकारी: ${p.fields}।`,
    STATE_NOT_KARNATAKA: () => 'पुष्टि कि स्टोर कर्नाटक में होगा।',
    NEGATIVE_OR_IMPOSSIBLE_VALUE: (p) => `इस जानकारी में सुधार: ${p.values}।`,
    DUPLICATE_ID: () => 'आपके आवेदन की पुष्टि: एक ही आवेदन संख्या से दो फ़ॉर्म मिले हैं।',
    DUPLICATE_APPLICANT: () => 'पुष्टि कि यह अलग आवेदन है: आपके नाम और पिन कोड से दो आवेदन मिले हैं।',
    LAUNCH_UNREALISTIC: (p) => `आपकी स्टोर खोलने की योजना: ${p.target} महीने, नए स्टोर के लिए आम तौर पर लगने वाले ${p.lead} महीनों से कम है।`,
    NOTE_TIMELINE_CONFLICT: (p) => `आपकी स्टोर खोलने की तारीख: आपने "${p.label}" (${p.date}) लिखा है, जो नए स्टोर के लिए ज़रूरी समय से मेल नहीं खाता।`,
    NOTE_EXPERIENCE_CONFLICT: (p) => `आपके खुदरा अनुभव के वर्ष: फ़ॉर्म में ${p.field} लिखा है, लेकिन आपके विवरण में ${p.text} है।`,
    NEAR_MISS: (p) => `कोई भी जानकारी जो आपके आवेदन को मज़बूत करे, जैसे ${p.fix}।`,
    RESERVATION_EXPIRED: () => 'पुष्टि कि आप अब भी आगे बढ़ना चाहते हैं; अनुबंध समय पर न होने से आपका आरक्षण समाप्त हो गया है।',
    CITY_UNRECOGNISED: (p) => `शहर की पुष्टि (आपने "${p.raw}" लिखा है)।`,
    UNPARSEABLE_VALUE: (p) => `${p.field}, जिसे हम पढ़ नहीं पाए।`,
  },
  reason: {
    PIN_TAKEN_BY_HIGHER_RANK: (p) => `पिन ${p.pin} के लिए किसी दूसरे आवेदक का चयन हुआ है, और हम एक पिन कोड में केवल एक स्टोर खोलते हैं।`,
    SLOTS_FULL: () => 'आपके क्षेत्र की सभी खाली जगहें अभी भर चुकी हैं।',
    NO_SLOTS: () => 'अभी हम आपके क्षेत्र में नए स्टोर नहीं खोल रहे हैं।',
    RELEASED_BY_OVERRIDE: () => 'आपके लिए आरक्षित जगह हमारी टीम ने किसी और को दी है।',
    OUTSIDE_TERRITORIES: (p) => `अभी हम पिन ${p.pin} में स्टोर नहीं खोल रहे हैं।`,
    PIN_HAS_STORE: (p) => `पिन ${p.pin} में हमारा स्टोर पहले से है, और हम एक पिन कोड में केवल एक स्टोर खोलते हैं।`,
    CAPITAL_INSUFFICIENT: (p) => `${p.city} में स्टोर के लिए न्यूनतम निवेश ₹${p.min} लाख है, और आपके आवेदन की राशि इससे काफ़ी कम है।`,
    SCORE_BELOW_BAR: (p) => `आपका आवेदन हमारे मौजूदा मानदंडों पर खरा नहीं उतरता, मुख्य रूप से ${p.area} के मामले में।`,
    OTHER: () => 'आपका आवेदन हमारे मौजूदा मानदंडों पर खरा नहीं उतरता।',
  },
  area: { financial: 'निवेश क्षमता', operator: 'खुदरा अनुभव', site: 'दुकान की जगह', launch: 'स्टोर खोलने के समय', territory: 'स्थान' },
};

const DICTS: Record<Language, Dict> = { English: EN, Kannada: KN, Hindi: HI };

const NEAR_MISS_FIX: Record<Language, Record<string, (p: P) => string>> = {
  English: { score: () => 'a ground-floor space', launch: (p) => `an opening target of ${p.lead} months`, capital: (p) => `an investment of ₹${p.inv} lakh` },
  Kannada: { score: () => 'ನೆಲ ಮಹಡಿಯ ಜಾಗ', launch: (p) => `${p.lead} ತಿಂಗಳ ಆರಂಭದ ಗುರಿ`, capital: (p) => `₹${p.inv} ಲಕ್ಷ ಹೂಡಿಕೆ` },
  Hindi: { score: () => 'भूतल (ग्राउंड फ़्लोर) की जगह', launch: (p) => `${p.lead} महीने में स्टोर खोलने का लक्ष्य`, capital: (p) => `₹${p.inv} लाख का निवेश` },
};

interface MessageFacts {
  w: Work;
  cfg: ConfigValues;
  asOf: string;
  redirects: Redirect[];
  whatWouldChange: Counterfactual[];
}

function flagParams(w: Work, code: string, d: Dict): P | null {
  const f = w.app.flags.find((x) => x.code === code);
  if (!f) return null;
  const p: P = { ...(f.params ?? {}) };
  if (code === 'NOTE_TIMELINE_CONFLICT' && p.date) p.date = d.date(String(p.date));
  return p;
}

function build(lang: Language, x: MessageFacts): string {
  const d = DICTS[lang];
  const { w, cfg } = x;
  const a = w.app;
  const name = a.name === '(name missing)' ? (lang === 'English' ? 'Applicant' : lang === 'Hindi' ? 'आवेदक' : 'ಅರ್ಜಿದಾರರೇ') : a.name.split(' ')[0];
  const rawCity = w.territory?.city ?? a.pinCity ?? a.city ?? '';
  const city = d.city[rawCity] ?? rawCity;
  const lines: string[] = [d.greet(name), ''];
  const primary = w.reasons[0] === 'OVERRIDDEN' ? w.reasons[1] : w.reasons[0];
  const redirectLines = () => {
    const r = x.redirects[0];
    if (!r) return [];
    return ['', d.redirectIntro, d.redirect({ city: d.city[r.city] ?? r.city, pins: r.freePins.slice(0, 3).join(', ') })];
  };

  if (w.withdrawn) {
    lines.push(d.withdrawn({ id: a.id }));
  } else if (isApproved(w.outcome)) {
    const deadline = w.reservation ? d.date(w.reservation.deadline) : '';
    lines.push(w.conditions.length ? d.approvedCond({ id: a.id, city, pin: a.pin ?? '' }) : d.approved({ id: a.id, city, pin: a.pin ?? '' }));
    if (deadline) lines.push(d.reserved({ deadline }));
    if (w.conditions.length) {
      lines.push('', d.condIntro);
      for (const c of w.conditions) {
        const p = flagParams(w, c.code, d) ?? {};
        const text = d.ask[c.code]?.(p) ?? c.text;
        lines.push(`- ${text} (${d.by(d.date(c.deadline))})`);
      }
    }
    lines.push('', d.steps, d.step1, d.step2, d.step3, '', d.docs(a.space === 'Owned' ? d.ownProof : d.rentProof), d.training);
  } else if (w.outcome === 'HOLD') {
    lines.push(d.hold({ id: a.id }));
    const codes = [...new Set([...w.reasons, ...a.flags.filter((f) => f.severity === 'BLOCKING').map((f) => f.code), ...a.flags.filter((f) => f.severity === 'WARNING').map((f) => f.code)])];
    const tier = w.tier;
    let n = 0;
    for (const code of codes) {
      let p: P | null = null;
      if (code === 'SPACE_NOT_IDENTIFIED') p = { min: tier ? cfg.minSpaceSqft[tier] : '', pin: a.pin ?? '' };
      else if (code === 'SPACE_TOO_SMALL') p = { size: a.spaceSqft ?? '', min: tier ? cfg.minSpaceSqft[tier] : '' };
      else if (code === 'CAPITAL_SHORTFALL_SMALL' && tier && a.investmentLakh !== null) {
        const min = cfg.minInvestmentLakh[tier];
        p = { min, inv: a.investmentLakh, gap: Math.round((min - a.investmentLakh) * 10) / 10 };
      } else if (code === 'SCORE_NEAR_MISS') {
        const cf = x.whatWouldChange[0];
        const fixKind = cf?.kind === 'capital' ? 'capital' : cf?.kind === 'launch' ? 'launch' : 'score';
        const inv = cf?.change.match(/₹(\d+)/)?.[1];
        p = { fix: NEAR_MISS_FIX[lang][fixKind]({ lead: cfg.leadTimeMonths.withSpace, inv }) };
        lines.push(`${++n}. ${d.ask.NEAR_MISS(p)}`);
        continue;
      } else if (code === 'RESERVATION_EXPIRED') p = {};
      else if (code === 'SPACE_SIZE_WITHOUT_SPACE') continue;
      else p = flagParams(w, code, d);
      if (p && d.ask[code]) lines.push(`${++n}. ${d.ask[code](p)}`);
    }
    if (!n) lines.push(`1. ${d.ask.MISSING_REQUIRED({ fields: '—' })}`);
    lines.push('', d.howToSend({ deadline: d.date(addDaysIso(x.asOf, cfg.conditionDays)) }));
    const rank = rankOnceCleared(w.provisionalRank, x.whatWouldChange);
    lines.push(rank && w.territory && !w.pinTakenBy ? d.afterHoldRank({ rank, slots: w.territory.openSlots, city }) : d.afterHold);
    if (w.pinTakenBy) lines.push(...redirectLines());
  } else if (w.outcome === 'WAITLISTED') {
    lines.push(w.waitlistPosition ? d.waitlisted({ id: a.id, city, pos: w.waitlistPosition }) : d.waitlisted({ id: a.id, city, pos: '—' }));
    const r = d.reason[primary ?? ''];
    if (r) lines.push(r({ pin: a.pin ?? '' }));
    lines.push(d.waitNext, ...redirectLines());
  } else {
    lines.push(d.rejected({ id: a.id }));
    const weak = w.sr ? [w.sr.pillars.financial, w.sr.pillars.operator, w.sr.pillars.site, w.sr.pillars.launch, w.sr.pillars.territory].sort((p, q) => p.raw - q.raw)[0].key : 'operator';
    const min = w.tier ? cfg.minInvestmentLakh[w.tier] : '';
    const r = d.reason[primary ?? ''] ?? d.reason.OTHER;
    lines.push(r({ pin: a.pin ?? '', city, min, area: d.area[weak] }));
    lines.push(...redirectLines(), '', d.reapply);
  }
  lines.push('', d.sign);
  return lines.join('\n');
}

function addDaysIso(iso: string, days: number): string {
  const t = toDate(iso);
  t.setUTCDate(t.getUTCDate() + days);
  return t.toISOString().slice(0, 10);
}

export function buildMessage(x: MessageFacts): { language: Language; text: string; english: string } {
  const lang = x.w.app.language;
  const english = build('English', x);
  return { language: lang, text: lang === 'English' ? english : build(lang, x), english };
}
