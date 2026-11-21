# Payment-first leadership dashboard

## Install together with the payout package

1. Add `MW_Dashboard_PaymentReview.gs` as a new Apps Script file. Do not replace your payment scanner, late-fee manager, registration code or doGet.
2. Update `MW_Dashboard_Payouts.gs` to the included version; it adds dispatch of `fp_review_*` actions. The single hook already described at the top of your existing doPost stays the same. Do not add it twice.
3. Keep `PAYOUT_ADMIN_EMAILS` configured for the authorized treasurer/secretary Google accounts. The new review/profile and write actions use the same server-verified sign-in.
4. Add `MW_PaymentReview.js` to the root of the GitHub site. Include both files after the existing main dashboard script near the bottom of command.html:

   ```html
   <script src="MW_PayoutDashboard.js"></script>
   <script src="MW_PaymentReview.js"></script>
   ```

5. Redeploy the existing Apps Script web app to a new version, preserving its URL. Test against a copied workbook before using the write actions in production.

## What changes in the view

- The registration status table, registration summary cards, registration eligibility/pulse cards and older recent-payment widget are hidden. Their existing source is retained.
- A new PAYMENTS list excludes registration rows and orders actual payment dates newest first, with physical row number as a stable tie-breaker. Invalid dates are marked for review and sort last. Filters include search and Needs review; pages have 50 records.
- Click a member for the payment profile: non-registration payment history, exact fund obligations, actual payment dates, available funeral credit, applied credit per fund, discrepancies and declared family details.
- The fund dropdown shows both active and closed fundraisers. Its payment/obligation list uses the same fund-specific model as the profile.
- PAYMENTS column positions are found by their actual headers, including the real header row at row 10. The Fund column is read directly; a previous-balance column cannot be used as a fund code.
- Exact member and fund matches only. Registration money is never allocated across funeral funds. Available funeral credit is MEMBERS column S, not total registration receipts or prior contributions.
- TRACK and PAYMENTS disagreements are displayed as REVIEW; the view does not silently repair either source, assert benefit eligibility, or invent a payment.

## Late fees

- After the deadline day ends in Pacific Time, an unpaid $10 obligation is displayed as $15, unless paid/exempt/waived.
- An already assessed fee is not added again. Existing greater recorded balances are preserved.
- A fee due by policy but not yet assessed in TRACK is labelled clearly. Merely opening the view writes nothing. The scheduled late-fee manager remains responsible for routine assessment.
- A manually approved allocation or credit application that settles such an obligation explicitly previews and records the $5 assessment on that target row, so it is not assessed a second time later.
- Marking a fund CLOSED early does not move its payment deadline or charge fees before the deadline ends.

## Allocate an unresolved or lump-sum payment

1. Connect your officer Google account in the payout section, then load payments.
2. Choose **Needs review**, then **Fix / allocate** on an unresolved source row.
3. Enter explicit member IDs, fundraiser codes and dollar shares. You can allocate one transfer across multiple members and funds. Enter `CREDIT` for an explicitly approved excess; nothing is guessed or automatically redirected.
4. Shares must total the original amount exactly. An allocation cannot exceed the target obligation. Exempt, already paid, duplicated or inconsistent tracker targets are held for review.
5. Click **Dry run / preview**. Inspect the exact target rows/cells and before/after amounts. Nothing is saved or emailed.
6. Click **Confirm and apply** only after verifying the preview. The selected source remains as an audit record marked SPLIT-PROCESSED; confirmed child allocations are appended. Only the targeted TRACK rows, fund logs, numerical FUNDS totals and explicitly assigned credit balances are updated.

Confirmed or SETTLED rows, reversal guards and previously split sources cannot be allocated a second time by this form. A confirmed row with no memo is inspectable; it is not automatically charged again or reassigned.

## Apply existing credit

Open a member profile and choose **Apply credit** beside one unpaid fundraiser. Enter the amount and preview. On approval, MEMBERS column S decreases and that fund's TRACK Credit Applied increases. No new cash receipt is added to PAYMENTS or FUNDS totals; this moves existing credit rather than claiming new bank income. Applied credit is visible in that fund's profile row. The profile refreshes after success.

## Audit, retries and operational limits

- Completed approvals are recorded in the new `MW_PAYMENT_ACTIONS` sheet. Original dates/memos and source row references are retained for allocations.
- A shared script lock serializes these actions with payment routines using the same lock. An interrupted write stores a checkpoint and offers **Resume approved action**. Each target must still equal its approved before or after value; changed cells halt for review.
- These are resumable standard SpreadsheetApp writes, not an atomic Google Sheets transaction. Never clear the pending checkpoint to force a retry or use a different request ID to bypass a hold.
- No bulk reconciliation, historical fund reset, bank transfer, Gmail label change, receipt email or member eligibility change is performed.
- The underlying legacy registration and payment endpoints are not rewritten. The new view must be installed to replace the old profile display, and independent older reports retain their own logic.
- Local tests cover the real header layout, exact fund matching, credit not being reused, $15 overdue display, conservation of split amounts, credit movement without new cash, duplicate requests, stale preview refusal and partial-write recovery. Updated JavaScript passes syntax checks. Browser QA of this extension was blocked by the preview browser's URL policy; live authentication and Apps Script integration remain unverified.

Before live write use, first test read-only profiles and fund lists on your copied workbook, then test a single preview-and-apply scenario there and compare the exact changed rows. No live balances were changed during preparation.
