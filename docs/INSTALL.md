# Dashboard restored views update — v2

1. In the same Apps Script project, replace all five addon files with the supplied versions: `MW_Dashboard_Payouts`, `MW_Dashboard_PaymentReview`, `MW_Dashboard_Operations`, `MW_Dashboard_Claims` and `MW_Dashboard_Admin`. Add any of these files that are missing. Do not paste these inside another function. Keep the existing `doPost` dispatch hook once; do not add another `doGet` or replace the main bridge.
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

The older member payment table is visible again under Contributions & review. Click its column headings to sort, retain Paid/Partial/Unpaid filters, export the filtered member list to CSV/PDF, and select up to 20 members for previewed balance reminders. Fund rosters have search, sorting, paid/partial/unpaid/review filters, matching CSV/PDF exports and selected-member reminders. Contribution exports include all matching records, not only the 50-row page.

Clicking a name immediately shows available profile information. The established member-detail endpoint supplies the family and payment history; full fund checks are loaded separately on demand. A short in-memory cache speeds repeat opens and is cleared after confirmed dashboard mutations. Profiles use the classic compact layout, full registration/payment history and complete declared names. Missing claim-check code cannot turn declared family fields into “no beneficiaries.” Claim lookup reads member/fund records only and can return multiple claims for the same member. No claimed records are created from surnames or screenshots.

Due dates follow the existing Pacific calendar-day policy: a fund remains Active through its due date, and displays Closed the following day. Closed funds remain in the list and available for receipts, late payments, balances and payouts. This display rule does not rewrite stored FUNDS statuses.
