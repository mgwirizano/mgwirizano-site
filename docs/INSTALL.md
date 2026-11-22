# Dashboard workspace update

1. In the same Apps Script project, replace the four existing addon files with the supplied versions: `MW_Dashboard_Payouts`, `MW_Dashboard_PaymentReview`, `MW_Dashboard_Operations`, `MW_Dashboard_Claims`. Add the new file `MW_Dashboard_Admin`. Do not paste these inside another function. Keep the existing `doPost` dispatch hook once; do not add another `doGet` or replace the main bridge.
2. Replace the two website files `MW_PayoutDashboard.js` and `MW_PaymentReview.js`. Keep each existing script tag once. The included patches show the hooks only if they have never been installed.
3. Save and deploy a new version of the **same** Apps Script web app, then publish the two website files through your usual process. Refresh the dashboard.

The draft GitHub branch contains the source changes; it is not a production deployment. Start with read-only views and use a copied workbook to check a preview and confirmed action before team use.

No new login or PIN is added. These extension endpoints do not independently authenticate callers. Existing page login, notifications and timestamps are not server-side access restrictions. Shared dashboard activity does not identify the individual operator.

Keep your current scanner, removal, reminder and slides scripts. Consolidated reminders require `_crBuildMemberEmail_` and `_crBuildPlainText_`; meeting slides require `generateFundSlides`; Board-approved removal requires the existing notice/balance helpers; missing-email staging requires the existing scanner parsing/checkpoint helpers. A missing dependency stops its workflow with an error. Native SpreadsheetApp is used; no new Sheets API setup.

Settings must contain the leadership email, group name and Zelle email. Email sends use the existing `sendEmail` helper. A recorded sent flag or successful send call does not prove delivery.

No live financial edits, notices, member removals or emails were run while preparing this package. Synthetic tests cover source conservation, stale previews, repeat protection, selected-member actions, profile/claim data and new fund exemptions/credit effects. Live browser appearance and Gmail delivery still need an installation check.
