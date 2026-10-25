// Layer 5: post-decision outputs per applicant (onboarding, documents, readiness, risk, message).
// Filled in Phase 3.

import type { CoreResult, Work } from './decide';
import type { Counterfactual, Decision, Redirect } from './types';

export function buildPost(w: Work, _core: CoreResult, _redirects: Redirect[], _cf: Counterfactual[]): Pick<Decision, 'onboarding' | 'documents' | 'readiness' | 'risk' | 'message'> {
  return { onboarding: null, message: { language: w.app.language, text: '', english: '' } };
}
