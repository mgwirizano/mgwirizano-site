# Fund balances and payout entry

This adds a fund selector, recorded family balance, printable report and payout-entry form to command.html. Nothing has been installed in the live Apps Script or written to the live spreadsheet.

## Install the backend first

1. In your existing Apps Script project, add a script file named `MW_Dashboard_Payouts`. Paste the contents of `MW_Dashboard_Payouts.gs`. Alternatively append those functions to `MW_Dashboard_Bridge_Functions_2.gs`; use only one copy. Keep its pending-report and fund-close functions unchanged.
2. At the top of your **existing** `doPost(e)`, immediately inside its opening brace, add:

   ```javascript
   var fpResponse = mwPayoutDashboardDispatch(e);
   if (fpResponse) return fpResponse;
   ```

   Do not create another doPost, replace doGet, or replace the rest of your registration handler. The supplied `MW_WebApp.gs.patch` adds just this hook to the repository version; use the two-line insertion if your live copy has other changes.
3. Save and update the current web-app deployment to a new version. Keep the existing URL. No Google Sheets API setup or new timer is required. UrlFetchApp is used to verify the Google sign-in with Google.
4. Set Apps Script property `PAYOUT_ADMIN_EMAILS` to a comma-separated list of authorized treasurer/secretary Google sign-in emails. This is required and fails closed until configured. No private account allowlist is published with this module. This server setting controls the new section; the existing dashboard's broader access list does not grant payout access.
5. Add `MW_PayoutDashboard.js` to the root of your GitHub site. In command.html, add this ONE line after the existing closing `</script>` near the bottom, immediately before `<div id="toast"></div>`:

   ```html
   <script src="MW_PayoutDashboard.js"></script>
   ```

   `command.html.patch` contains exactly this insertion. No original dashboard HTML or existing PIN/password needs to be copied into a replacement file. Keep all existing dashboard code unchanged. Do not add the payout module twice.


## First run: read-only checks

1. Open the dashboard. Use Google sign-in, then click **Connect treasurer / secretary account**. If you entered the old dashboard by PIN or your session was restored, the new section asks for Google sign-in separately. The PIN cannot authorize new payout writes.
2. Select a known fund. Active and closed funds are included. Check its family share and PAYOUTS history against your report and bank records.
3. Expand **Record a payment already sent**. Enter a real payment date, category, amount, receiver, platform, description and bank confirmation reference.
4. Click **Preview only**. This reads sheets without writing rows or sending email. Review the remaining family share after recording.
5. Only when correct, click **Confirm and record payment** and accept the confirmation. One row is appended to PAYOUTS columns A:H. No transfer occurs. No PAYMENTS, TRACK, FUNDS or MEMBERS records are rewritten.

## Calculation

- Fully paid and covered-by-credit contributors × the fund's standard contribution in FUNDS column E.
- Plus capped partial payments. As in the supplied quickFundReport, a partial row mentioning a late fee deducts $5 before determining its core share; ambiguous allocations are flagged for review.
- Less 5% administration = calculated family share.
- Less recorded family payouts = remaining family share.
- This preserves the supplied report's calculation model, with the contribution amount read per fund rather than hardcoded to $10. It does **not** enact the proposed $3,500 fixed-benefit policy.
- Credit-covered participation is included. This is a recorded allocation calculation, not a bank reconciliation or independently verified cash balance. Removed members absent from TRACK are not reconstructed.
- Existing PAYOUTS rows with the selected fund code are treated as family payments unless their descriptions indicate refunds/expenses. They appear in the history and are flagged as legacy classification to verify. New records have an explicit category in Notes.
- Refunds and organization expenses are recorded but do not reduce the family payout total. Organization payments can have no fund.
- An authorized advance from reserves may exceed current collected family share. Check its explicit acknowledgment in the form; the preview shows a negative remaining share where applicable. That value is a funding gap/advance, not proof of an erroneous payment.
- Missing historic payouts make the remaining balance too high. Add them individually using the actual bank references before relying on the result. The old FUND-008 advance with an invalid date stays untouched and is flagged.

## Retry and corrections

- Same request ID is retry-safe. A bank reference already recorded by this section is blocked. A same-date/fund/amount/receiver match to a legacy row is held for review.
- Existing legacy notes without structured reference markers are not a comprehensive bank transaction index. Review payout history and bank references before backfilling.
- If another entry or the fund's calculation changes after preview, saving stops and requires a new preview.
- For a connection error after save, retry the same request. Do not click New payment or change the reference to bypass a duplicate warning.
- This form is append-only; corrections to existing payout history remain manual. No automatic deletion, reversal, receipt email or member notice is added.
- Reports use your browser's Print / Save PDF button. They include the calculation, payout history, notes and member breakdown. There is no email action for this report.

## Validation completed

Local tests covered money in cents; partial and credit-covered participation; exclusions; 5% calculation; prior payouts; category separation; duplicate and stale-preview protection; reserve advances; invalid dates and amounts; role checks; repeat-safe append; and unchanged existing router logic. A browser demonstration verified the balance display and preview-only form.

Live Google authentication, browser-to-Apps-Script POST and a test payout have **not** been exercised against your deployed project. Verify the read-only fund lookup first; use a copy of the workbook to test a write before enabling production use. No live financial data was changed during development.
