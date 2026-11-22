# Update: no extra login or PIN

1. Replace the contents of the existing Apps Script files `MW_Dashboard_Payouts` and `MW_Dashboard_PaymentReview` with these versions. Keep the existing doPost dispatch hook once. Leave doGet and the main bridge unchanged.
2. Replace the two site files `MW_PayoutDashboard.js` and `MW_PaymentReview.js`. Keep their existing script tags once each.
3. Save and deploy a new version of the same Apps Script deployment. Publish the updated site files through your normal process.

No PAYOUT_ADMIN_EMAILS property, extra Google login or PIN is required. Payments and funds load automatically. The extension endpoints do not independently authenticate callers; the existing page login is not server-side access control for them. A shared page URL or email notification is not an access restriction.

The existing `getSettings().leaderEmail` must be configured before new financial writes. Notifications use the existing `sendEmail` helper. No new email service or Sheets API is needed. Each completed new dashboard action sends a leadership notification with timestamp, request ID and payout/allocation details. Shared dashboard entries do not establish which individual submitted them. An email failure is reported after saving, without replaying the financial change; inspect the record rather than create another request. Existing receipt checks prevent a completed request from applying twice or sending another notification on a normal retry. A runtime interruption after saving can leave the notification unsent; the ledger receipt remains the record of completion.

Fund cards now include the FUNDS column J due date and claiming member from FUNDS column L, matched to MEMBERS column Q (ID) and C (name). Missing details are labelled rather than guessed.

First check the payment feed, fund dropdown, member history and balance reports read-only. Test financial actions on a copied workbook: preview first, inspect target amounts, then confirm. Preview sends no email and changes no financial cells. No live spreadsheet edits or notifications have been run as part of preparing this update.
