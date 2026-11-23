# Dashboard interactive operations update — v4

1. In the same Apps Script project, replace all seven addon files with the supplied versions: `MW_Dashboard_Payouts`, `MW_Dashboard_PaymentReview`, `MW_Dashboard_Operations`, `MW_Dashboard_Claims`, `MW_Dashboard_Admin` `MW_Dashboard_Actions` and the new `MW_Dashboard_Reports`. Add any of these files that are missing. Do not paste these inside another function. Keep the existing `doPost` dispatch hook once; do not add another `doGet` or replace the main bridge.
2. Replace the two website files `MW_PayoutDashboard.js` and `MW_PaymentReview.js`. Keep each existing script tag once. The included patches show the hooks only if they have never been installed.
3. Save and deploy a new version of the **same** Apps Script web app, then publish the two website files through your usual process. Refresh the dashboard.

The draft GitHub branch contains the source changes; it is not a production deployment. Start with read-only views and use a copied workbook to check a preview and confirmed action before team use.

No new login or PIN is added. These extension endpoints do not independently authenticate callers. Existing page login, notifications and timestamps are not server-side access restrictions. Shared dashboard activity does not identify the individual operator.

Keep your current scanner, removal, reminder and slides scripts. Consolidated reminders require `_crBuildMemberEmail_` and `_crBuildPlainText_`; meeting slides require `generateFundSlides`; Board-approved removal requires the existing notice/balance helpers; missing-email staging requires the existing scanner parsing/checkpoint helpers. A missing dependency stops its workflow with an error. Native SpreadsheetApp is used; no new Sheets API setup.

Settings must contain the leadership email, group name and Zelle email. Email sends use the existing `sendEmail` helper. A recorded sent flag or successful send call does not prove delivery.

No live financial edits, notices, member removals or emails were run while preparing this package. Synthetic tests cover source conservation, stale previews, repeat protection, selected-member actions, profile/claim data and new fund exemptions/credit effects. Live browser appearance and Gmail delivery still need an installation check.

## Fix “Unknown payout action”

This message means the deployed server does not recognize a newer website action. Adding only `MW_Dashboard_Admin` does not update the old dispatcher. Replace **MW_Dashboard_Payouts** as well as the other supplied addon files. Then in Apps Script select **Deploy → Manage deployments → Edit (pencil) → Version: New version → Deploy**. Keep the same deployment and `/exec` URL. Hard-refresh the website after updating both JavaScript files. Do not create another doGet.

The UI now identifies this version mismatch and keeps the available member summary visible. Advanced actions still require the matching server deployment; they are not silently bypassed.

## Restored controls and faster profiles

The older member payment table is visible again under Registration & members. Click its column headings to sort, retain Paid/Partial/Unpaid filters, export the filtered member list to CSV/PDF, and select up to 20 members for previewed balance reminders. Fund rosters have search, sorting, paid/partial/unpaid/review filters, matching CSV/PDF exports and selected-member reminders. Contribution exports include all matching records, not only the 50-row page.

Clicking a name immediately shows available profile information. The established member-detail endpoint supplies the family and payment history; full fund checks are loaded separately on demand. A short in-memory cache speeds repeat opens and is cleared after confirmed dashboard mutations. Profiles use the classic compact layout, full registration/payment history and complete declared names. Missing claim-check code cannot turn declared family fields into “no beneficiaries.” Claim lookup reads member/fund records only and can return multiple claims for the same member. No claimed records are created from surnames or screenshots.

Due dates follow the existing Pacific calendar-day policy: a fund remains Active through its due date, and displays Closed the following day. Closed funds remain in the list and available for receipts, late payments, balances and payouts. This display rule does not rewrite stored FUNDS statuses.

## v3: interactive daily operations and member receipts

Add **MW_Dashboard_Actions** to the same Apps Script project and replace the other five addon files and two website scripts with this package. Keep the existing dispatch hook once. Save and deploy a new version of the same web app. This package replaces v2.

Zelle/contribution review appears before the registration member list. Recent payments is a separate workspace tab, with member links, inspect buttons and an Unsent receipts shortcut. Overview totals, daily/monthly charts and action references open their underlying records. Daily work includes fund reports, quarterly reports and multi-ID member checks.

Approved allocations now send the existing branded member receipts through `buildFuneralReceiptEmail` / `buildConfirmEmail` and your existing `sendEmail` helper. The leadership audit also uses HTML. Email Sent is changed only for the correct payment row after the helper confirms success. An uncertain send stays flagged for verification; it is not automatically retried. Historical NOT SENT rows are not bulk-mailed by installation: inspect a row → Send unsent receipt → preview → confirm. Missing templates or bad member emails are reported without replaying a saved payment.

A source-linked allocation automatically marks its original review source DISMISSED in the member/status columns and marks its receipt field Not applicable. The original amount, bank date, sender and memo remain. Only the posted child rows count as receipts. For money already added by a legacy manual tool, choose **Already posted? Link existing payments**, identify the exact posted row(s), verify their allocation and preview. The selected amounts must equal the source, and rows already linked elsewhere are held. No amount-only or fuzzy-name auto-dismissal runs.

The guided reversal supports verified funeral contributions: exact original fund-log match, consistent ledger/TRACK/FUNDS figures, retained REVERSED source row, negative fund-log adjustment, restored unpaid balance and HTML member notification. Verified registration and unspent-credit receipts can also be reversed, with original-row archival and a non-financial re-import guard. Ambiguous or already-spent credit is held for review; registration credit cannot be counted twice. Unpaid late-fee reversal is available from verified fund obligations. Neither action sends a bank refund.

Fund reports produce full paid+pending or pending-only HTML reports emailed to leadership. Fund-roster CSV/PDF export remains available. Quarterly reports create a written Google Doc and PDF using actual PAYMENTS/PAYOUTS dates within the selected quarter, through today for an ongoing quarter. Review exceptions are listed, and net period movement is never labelled bank balance. The optional meeting deck reuses your supplied `_mwBuildMeetingModel_` and `_mwCreateQuarterlyMeetingSlides_` helpers and is separately labelled cumulative progress. It requires the existing configured verification tabs; the dashboard does not insert sample financial data. Existing report-folder helpers are reused if installed, and existing file permissions are preserved.

All verification used local synthetic data. No live member emails, reversals, source dismissals or report generation have been run while preparing this package. Live email delivery and report-file access require a deployment check.


## Member follow-up and mobile update

A read-only banner loads with the dashboard. Four or more verified overdue funds trigger a warning flag. Exemptions, paid/credit-covered funds and not-yet-due funds do not count. Sent warnings show their response deadline. After that date, remaining debt on the originally notified obligations triggers **Removal review needed**. Payment or applied credit resolves that notice; newer unrelated debt does not keep it open. Warning emails and Board-approved removal still require a preview and confirmation. Existing sent or uncertain delivery audits prevent blind repeat warnings. Run the separate archived cleanup preview after removal; paid and applied-credit history is preserved.

In Admin workflows choose **Set registration alert window** and enter the actual start and end dates. Fee alerts remain inactive until dates are configured and the window closes. They apply only to members who joined in that cohort, use verified registration cash/prior credit, and have their own warning message and response deadline. This setting does not open/close the registration form or rewrite payment records.

Mobile navigation scrolls within the tab bar. Tables with headings become labelled records, inputs stack, the profile drawer fills the screen, actions have touch-sized targets, and wide content stays inside its panel. Dark and light themes retain the existing colors. Synthetic layout/label checks pass; installed mobile-browser appearance remains to be checked.

**Missed registrations:** scan in Registration & members, then choose **Recover selected missed registrations** and enter the exact row numbers. Preview assigns IDs above the known historical maximum, archives original rows, and preserves all financial cells, family details and existing IDs. Duplicate/shared emails and same-name records require review. No welcome email is sent by recovery; preview selected welcome resends next.

The supplied original `onFormSubmit` is not replayed: it assigns a new ID even for an existing row, scans only current IDs, and clears credit / writes a numeric credit into the registration-status column. Its duplicate-email comparison also reads column A rather than B. This addon leaves that original handler unchanged. **Correct and test that original intake handler before opening the new registration form**; dashboard recovery does not fix the installed form trigger. The dashboard resend action uses a separate HTML message, tracks uncertain sends and preserves IDs/credit.


## v4: Financial reports and approved top summary

Add **MW_Dashboard_Reports.gs** to the same Apps Script project. Replace the supplied Actions/Payouts addon versions and the two website scripts, then deploy a new version of the same web app. No additional website script tag is needed. The Reports module reads existing records; it does not insert screenshot figures, change payments, send emails or rebuild trackers.

The **Financial reports** workspace has fund performance, fund calculation, payouts/refunds/expenses, current member balances and a printable Board package. Amount buttons open supporting calculations/rows. Contribution distributions count receipt entries, not unique members. Cash activity date filters apply to receipts and outgoing entries only. Fund pools and member balances use current records and are explicitly labelled; past tracker balances cannot be reconstructed by filtering current rows.

The approved styling changes only `#sec-overview` summary cards: compact translucent navy, centered text, green/red/gold/blue figures, no emoji or donut, preserved dynamic amounts and existing click handlers. Existing tabs, headers, main cards and other sections keep their styling. On narrow screens the top cards wrap, and the report matrix becomes expandable member cards. Browsers without backdrop-filter retain a readable navy fallback. No image mockup figures are hardcoded into the website.

### Optional verified bank amount adjustments

The report will not infer the example $0.33 difference from an image. If you already have verified deltas, a separate **PAYOUT ADJUSTMENTS** sheet can expose them with exactly these row-1 headers:

`Date | Fund Code | Adjustment Amount | PAYOUTS Row | Explanation | Status`

Dates and signed adjustment amounts must be real date/number cells. Reference the original matching family PAYOUTS row number. Only **VERIFIED** rows are read; ambiguous duplicate deltas for one payout stop the report. The delta is displayed separately and reduces the calculated family balance, without rewriting the original payout, adding another cash payment or altering the recorded period outgoing total. A delta is the difference between the bank amount and the original recorded transfer, not the full transfer amount. Settlement/pending status is not established from PAYOUTS alone.

If the register does not exist, the report says adjustment/settlement evidence is unavailable. No sheet or adjustment is created automatically. Keep row references current if PAYOUTS rows are inserted/deleted.

Embedded late fees are not invented from receipt amounts or outstanding assessments. Separately posted late-fee receipts are shown, and the difference between cash, applied credit and the existing tracker pool is exposed for allocation review. Pool assumptions/warnings remain visible in the fund breakdown and printed package. Admin retention is part of the core base, not another bank debit.

CSV export follows the selected view and member/category filter. Board PDF prints the complete loaded report, including fund calculations and current owing members. Browser-generated PDF uses Print / save PDF; the existing confirmed quarterly document/email generator remains a separate explicit action. Dates and generated timestamps print with the report.


## v4.1: Use payment suggestions

The unmatched-payment drawer now shows **Use suggestions & preview** when a verified member/fund proposal exactly matches the received amount. Clicking it re-reads the source and balances, fills the allocation rows and starts the existing read-only dry run. **Confirm and apply** remains the deliberate financial action; the normal audit, stale-preview protection, source dismissal and member receipts are reused.

A bare member number such as `No 323` can propose `MW0323` with the member's full name and an identity-verification label. Explicit `fund 008 to 011` references fill all four verified fund balances, including disclosed applicable late fees. This never copies an old scanner proposal from Notes. When balances total $60 for a $60 source, no typing is needed before preview/confirmation.

A mismatch stays visible; there is no equal/proportional split or automatic excess credit. Multiple member candidates require choosing one, and explicit memo dollar amounts/multiple IDs leave amount fields for manual verification. Ambiguous surname references, unknown funds, missing member candidates and protected/already-posted sources cannot be filled automatically. Paid/exempt obligations are skipped. Inconsistent tracker balances leave the amount blank. Manual edits made while the recheck runs are preserved and require a retry. Filling fields does not post a payment, dismiss the source, or send an email.

For an already-installed v4, replace **MW_Dashboard_Admin.gs**, deploy a new version of the same Apps Script web app, and replace **MW_PaymentReview.js** on the website. All other dashboard styling and report features are retained. For older installations, use the full package installation steps above first.
