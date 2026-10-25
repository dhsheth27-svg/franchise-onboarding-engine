// Helpers for sending applicant messages through the team's own channels (no messaging service needed).
import type { Decision, Language, Outcome } from './engine/types';

const SUBJECT: Record<Language, Record<Outcome, string>> = {
  English: {
    APPROVED: 'Your franchise application is approved',
    APPROVED_WITH_CONDITIONS: 'Your franchise application is approved (a few points to confirm)',
    HOLD: 'Your franchise application: information needed',
    WAITLISTED: 'Your franchise application: waitlist update',
    REJECTED: 'Your franchise application: update',
  },
  Kannada: {
    APPROVED: 'ನಿಮ್ಮ ಫ್ರಾಂಚೈಸಿ ಅರ್ಜಿ ಅನುಮೋದನೆಗೊಂಡಿದೆ',
    APPROVED_WITH_CONDITIONS: 'ನಿಮ್ಮ ಫ್ರಾಂಚೈಸಿ ಅರ್ಜಿ ಅನುಮೋದನೆಗೊಂಡಿದೆ (ಕೆಲವು ಅಂಶಗಳ ದೃಢೀಕರಣ ಬೇಕು)',
    HOLD: 'ನಿಮ್ಮ ಫ್ರಾಂಚೈಸಿ ಅರ್ಜಿ: ಮಾಹಿತಿ ಬೇಕು',
    WAITLISTED: 'ನಿಮ್ಮ ಫ್ರಾಂಚೈಸಿ ಅರ್ಜಿ: ಕಾಯುವ ಪಟ್ಟಿಯ ಮಾಹಿತಿ',
    REJECTED: 'ನಿಮ್ಮ ಫ್ರಾಂಚೈಸಿ ಅರ್ಜಿ: ಮಾಹಿತಿ',
  },
  Hindi: {
    APPROVED: 'आपका फ्रैंचाइज़ी आवेदन स्वीकृत',
    APPROVED_WITH_CONDITIONS: 'आपका फ्रैंचाइज़ी आवेदन स्वीकृत (कुछ बातों की पुष्टि बाकी)',
    HOLD: 'आपका फ्रैंचाइज़ी आवेदन: जानकारी चाहिए',
    WAITLISTED: 'आपका फ्रैंचाइज़ी आवेदन: प्रतीक्षा सूची',
    REJECTED: 'आपका फ्रैंचाइज़ी आवेदन: जानकारी',
  },
};

export function whatsappLink(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export function emailLink(d: Decision, text: string): string {
  const subject = `${SUBJECT[d.message.language][d.outcome]} (${d.applicationId})`;
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
}

export type MessageState = 'to-send' | 'sent' | 'stale';

export function messageState(d: Decision): MessageState {
  if (!d.message.sent) return 'to-send';
  return d.message.sent.current ? 'sent' : 'stale';
}

const KEY = 'opsmith-sender-name';
export function getSender(): string {
  try {
    return localStorage.getItem(KEY) ?? '';
  } catch {
    return '';
  }
}
export function setSender(name: string) {
  try {
    localStorage.setItem(KEY, name);
  } catch {
    /* storage unavailable: name is asked again next time */
  }
}
