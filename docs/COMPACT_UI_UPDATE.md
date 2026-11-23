# Compact account review and process messages — UI v4.5

If v4.4 is already installed, replace only **MW_PaymentReview.js** on the website and hard-refresh. No Apps Script change, redeployment or automation setting is needed for this UI update. The server remains version 2026-11-22.4.4.

The Inspect account check now shows short unpaid/partial/unverified fund callouts grouped by member. Paid and credit-covered funds are summarized as a count, with exemptions counted separately. Full amounts, paid history, credit and verification notes remain inside View all fund details. Member names are plain readable headings rather than repeated narrow buttons. Account checking and credit-hold logic are unchanged.

Routine success messages close automatically after six seconds. Hovering or keyboard focus pauses the remaining countdown. A small accessible × replaces the large Dismiss message button. Running jobs remain visible and cannot be dismissed; errors and uncertain outcomes remain until manually dismissed. Hiding a message does not cancel work, clear an unresolved case or erase a report recovery reference.

19 packaged synthetic test files pass, including compact rendering, success timing, combined hover/focus pause and warning/running protections. No production records, email, jobs or deployment were changed. Browser visual verification remains an installation check.
