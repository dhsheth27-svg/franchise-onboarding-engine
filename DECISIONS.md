# Decisions and interpretations

Judgement calls made where the spec was ambiguous. Each is the simplest reasonable reading.

1. **Gate outcome precedence.** The spec says the first failing gate sets the outcome. Exception: if a later
   gate gives a *reliable* REJECT (its inputs are not themselves flagged), the REJECT wins over an earlier HOLD
   or WAITLIST, because fixing the hold would not make the applicant viable (e.g. size missing *and* capital
   60% short -> reject, not "send us your size"). A REJECT based on a pin that is itself in doubt
   (pin/city mismatch, duplicate) does not win; the applicant is held to confirm.
2. **Gates whose inputs are missing are recorded as "skip"** in the trace (in addition to pass / fail / flag).
3. **Provisional score with no space.** An applicant with no space yet is scored as if they found the minimum
   compliant rented space on an unknown floor (the smallest change that clears the hold). This is labelled
   "provisional" everywhere. Launch realism still uses the 5-month no-space lead time.
4. **Ranks.** "Rank" in sentences means the position among applicants who hold a slot in that territory
   ("would rank #2 for 2 slots"). A held applicant's provisional rank is computed by inserting them among the
   current approvals without taking a slot. If their pin is already taken, the summary says a different pin
   would be needed.
5. **Tier used for minimums** = the territory's tier; if the territory row's tier contradicts the allowed-values
   city list, the city list wins and a data issue is logged. Outside any territory, the tier comes from the pin
   prefix (so a Davanagere applicant is checked against the Tier 3 minimum).
6. **Rows without an Application ID but with other data** are kept as `ROW-<n>` and held (MISSING_REQUIRED),
   rather than silently dropped. Fully blank rows are skipped. Duplicate IDs get an internal key `APP-017#2`.
7. **Unrecognised city text** with a valid pin: the pin's city is used and a WARNING is raised (confirm city).
   A recognised city that contradicts the pin prefix is BLOCKING (PIN_CITY_MISMATCH), as specified.
8. **Unreadable required number** (e.g. "twenty lakh") is treated as missing -> MISSING_REQUIRED (BLOCKING).
   Unreadable optional values -> UNPARSEABLE_VALUE (WARNING). Ranges like "20-25" use the lower bound.
9. **Withdrawn applicants** keep the outcome REJECTED with reason WITHDRAWN and are shown as "Withdrawn" in the UI
   (the five outcome definitions are unchanged).
10. **Expired reservations** become HOLD (RESERVATION_EXPIRED) and are excluded from allocation; the slot passes
    to the next eligible applicant on the same run. A reservation is fulfilled by an "agreement" milestone dated
    on or before the deadline. Approval dates are carried forward from the parent run version (`priorApprovals`),
    so a newly promoted applicant's 30 days start on the day of promotion.
11. **Diwali.** The run date is 25 Oct 2026; Diwali 2026 is 8 Nov 2026 (14 days away), shorter than any lead
    time, so every "before Diwali" note conflicts. The condition asks the applicant to confirm the date (they may
    mean Diwali 2027, 29 Oct 2027, also in config).
12. **Commitment deduction** (operator pillar): part-time / side business -10, hiring a manager -10, capped at -15.
13. **Size fit** stays at 100 from the ideal minimum up to 2x the ideal maximum, then falls linearly to 40 at 4x.
14. **Cannibalisation**: city part = min(1, city stores / crowding threshold by tier) x 4 points; pin part = 6 points
    if a store shares the first 5 digits, 3 if the first 4. Capped at 10. Pin closeness is a stand-in for distance.
15. **Payback** (informational only) = tier minimum investment / (monthly sales x margin - base costs - rent),
    with rent zero for owned spaces. All inputs are illustrative and labelled so.
16. **Overrides.** A forced approval is checked against the allocation the engine would make without it. If its pin
    or the territory's slots are taken, it is refused unless the team names an approval to release; the released
    applicant becomes WAITLISTED (RELEASED_BY_OVERRIDE). Pins with existing stores and pins outside territories can
    never be overridden. Forced HOLD / REJECT / WAITLIST simply remove the applicant from allocation.
17. **Redirect order**: same territory (if it still has a free slot and pin), then same city, then cities named in
    the notes, then other cities by priority (only if the notes show flexibility or name the city).
18. **A space reported in a follow-up without its size** ("APP-012 has now found a ground-floor space") is a real
    change of circumstance, so it clears the "no space" hold and the applicant is approved *with a condition*:
    confirm the size meets the tier minimum within the condition window. Nothing is invented: if the confirmed size
    is too small, the next update puts them back on hold. An *uploaded* row that says Owned/Rented with a blank size
    is still held (SPEC case 5), because there the size was simply left out of the application.
19. **Follow-up wording.** "APP-x confirmed the store is in <city>" updates the city when it matches the pin (clearing
    a pin/city mismatch). "Can APP-x open in <city> instead?" is a what-if on the first free pin in that city, assuming
    a new space is needed there. "APP-x has moved to <city>" without a pin asks which pin, rather than guessing.
20. **AI provider.** The spec names the Anthropic API for the optional AI layer; at the team's request it uses the
    OpenAI API instead (`OPENAI_API_KEY`, model `gpt-4o-mini` by default, strict JSON-schema output validated with zod).
    Its role is unchanged: it only reads free text and parses follow-up messages; it never decides an outcome, and any
    failure falls back to the keyword rules.
