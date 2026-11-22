# Dashboard operations update

## Install

1. Replace the existing Apps Script files `MW_Dashboard_Payouts` and `MW_Dashboard_PaymentReview` with these versions. Add one new Apps Script file named `MW_Dashboard_Operations` using the included `.gs` file.
2. Replace the website files `MW_PayoutDashboard.js` and `MW_PaymentReview.js`. Keep their existing two script tags, in the same order. No extra JavaScript file or doGet is required.
3. Save and update the same Apps Script deployment to a new version. Publish the website files and hard-refresh the dashboard.

Leave the existing scanner, late-fee manager, termination-notice script, main dashboard HTML and doPost hook in place. No API setup, new timer, automatic reconciliation, bulk rebuild or greedy allocation was added. No live records or emails were changed while preparing this package.

## Calculation and appearance

Calculation notes now show the full arithmetic: full/credit-covered count × base contribution, included partial core amounts, total core base, 5% admin deduction, family share, earlier family payouts, and net remaining. The same calculation appears in the printable report. The figures use the existing report method; late-fee allocation warnings remain visible, and recorded late fees are excluded from the core family share. Credit-covered participants are explicitly labelled. The example $2,975 − $148.75 − $1,500 = $1,326.25 is tested, not hard-coded into live fund reports.

Light mode uses a white background; dark mode retains the navy palette. Use the Light mode / Dark mode button in the header. The preference is saved in the same browser. Member profiles have Details, Fund obligations, Payments and Beneficiaries tabs. Beneficiaries displays the declared family records; it does not create a coverage or eligibility decision. Available credit remains MEMBERS column S.

## Daily Zelle review

Open Contributions & review, then Zelle review. Inspect an unresolved payment, enter exact member IDs, fund codes and shares, preview, then confirm. Shares must total the source amount, including any explicitly selected CREDIT share. Unequal shares such as $10 to FUND-010 and $5 to FUND-011 are supported when the verified obligations permit them. A confirmed payment, settled guard, already split source or inconsistent tracker cannot be allocated again.

Use Dismiss this unresolved payment for investigated sources that should be excluded. Enter a reason, preview and confirm. The original row, sender, amount, date and memo remain. Only the selected row's member marker, status and audit note become DISMISSED. This is not a reversal or refund. Use Dismissed history to inspect previous dismissals.

The ledger review screen covers PAYMENTS rows. Bank emails not yet recorded provides a separate read-only Gmail scan for the last 24 hours, 7 days or 30 days, with conversation pagination. Every message is checked individually; no Gmail processed-label exclusion or calendar-day query boundary is used. Labels and unread status are not changed.

Bank-email review uses the existing `parseZelleAmount`, `extractMemberIdsAndNames`, `_loadZelleDayState_` and `_saveZelleDayState_` functions. These contracts were checked against the earlier supplied scanner module; compatibility with the current live scanner must be verified on a workbook copy. The bank sender must be configured in `getSettings().zelleFrom`. Missing parsers/checkpoint helpers or an unverifiable sender/amount hold the source. A message already marked applied/recorded by the scanner cannot be imported here. A matching transaction reference, source marker, or possible existing same-sender transaction that day also holds import. This deliberately requires investigation for repeated same-day transfers and possible split payments.

Preview staging, then confirm staging for a verified missing source. Under the same script lock used by the supplied scanner, its message checkpoint is reserved as REVIEW before a single UNMATCHED row is written. An interrupted import remains held for retry rather than letting the scanner independently allocate it. This step does not pay a fund or add credit. Open the staged row in Zelle review for explicit allocation. Existing member receipt mail is not sent by this new review tool; PAYMENTS child rows retain NOT SENT. Leadership receives the existing timestamped completion notification after allocations/dismissals. Do not run another recovery/posting tool on the same email concurrently.

## Five or more missed funds

The 5+ missed funds tab reads fund-specific PAYMENTS and TRACK balances after the due date ends in Pacific Time. Approved exemptions, tracker holds, existing EXCLUDE/RESOLVED decisions and previously sent warnings are protected. Missing/contradictory obligations are held for investigation; known admin-reviewed missing tracker gaps are surfaced if the existing helper is present, with no invented TRACK rows. All candidates and email previews are read-only.

Select 1–10 eligible members, choose a deadline allowing at least seven calendar days, and Preview selected emails. Inspect each recipient, subject, full message and amounts. Only Confirm and send selected warnings sends member emails. The existing `_buildTerminationNoticeEmail` function supplies your approved notice wording. No membership is removed.

A new MW_DASHBOARD_NOTICES audit reserves each member/deadline before email delivery. SENT and uncertain attempts cannot resend automatically. The selected REMOVAL REVIEW rows are updated individually after a successful send, or added if missing; other decisions and historical rows are not cleared. Inspect the audit and sent mail before resolving an uncertain delivery. Do not run the older notice sender concurrently with a dashboard batch.

## Verification

Synthetic workbook tests cover read-only previews, targeted allocation and dismissal, protected settled/confirmed rows, unequal allocation conservation, duplicate-safe staging, scanner checkpoint reservation, five-plus thresholds, existing exclusions/sent history, selected-only warning emails and no member removal. UI structure tests cover the sidebar and tab/form preservation. Live Gmail access, delivery and full browser rendering still require verification in your environment. First test on a copied workbook with test recipients; no real warnings are sent merely by opening or previewing this dashboard.

The extra Google login and PIN remain removed at your request. Notifications and a shared page login do not independently authenticate requests to these extension endpoints.
