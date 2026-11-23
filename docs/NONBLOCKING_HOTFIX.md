# Nonblocking dashboard hotfix — v4.7

Already on Apps Script v4.4 or later-compatible server: replace **MW_PayoutDashboard.js** and **MW_PaymentReview.js** on the website and hard-refresh. No Apps Script redeployment or financial-record change is needed. This includes all v4.5/v4.6 website changes.

## Root cause addressed

The previous progress hook attached almost any request to the last clicked button, then disabled every button/input/select in the surrounding card. A background alert or second read could inherit the first operation's Working label and lock unrelated controls. Reads waiting indefinitely also kept local loading flags active.

## Changed behavior

- Read-only loads and previews use their local inline messages; they do not create generic Working popups or lock sections.
- Confirmed record/email actions disable only their submitting button. Another request cannot take ownership of that button or restore another operation's state. Other parts of the dashboard remain available.
- Ordinary read waits stop after 30 seconds. Heavier bank-inspection/admin-preview reads allow 60 seconds. Only the browser's read wait is aborted; Apps Script may continue its read. The caller's finally block releases its local loading flag and an explicit retry is available. No automatic retry runs.
- Confirmed write waits have a 120-second connection deadline. A deadline is an UNKNOWN outcome, not cancellation or success. The server write is not aborted or replayed. Existing request IDs, journals and report reservations remain authoritative.
- Report status polling pauses after eight checks, including repeated connection failures. The reference remains available for a manual Check status and audit review. Duplicate generation of a pending/uncertain report remains protected; unrelated reads and actions do not depend on the read popup.
- Pure read loading flags no longer hold the global legacy refresh guard. Unsaved forms, reviewed previews and active confirmed actions remain protected against a destructive page refresh.

This fixes browser locking and indefinite waiting; it does not make spreadsheet/PDF/Gmail work instantaneous or claim that an unconfirmed server write stopped. Server-side job duration has not been live-profiled. No production emails, payments, scans, jobs or deployments were run.

Verification specifically exercises background reads after a click, unrelated controls during submissions, read timeout/retry, uncertain write timeout without abort/replay, and bounded report polling, in addition to the existing financial correctness tests.
