# Leadership dashboard workflows

## Member asks “How much do I owe?”

Click the member’s name → Profile details → **Send balance & owing history**. Read the recipient and complete statement, then confirm email or **Copy for WhatsApp**. Copying does not send a WhatsApp message. Each member receives a separate statement; a spouse’s information is not automatically included.

The statement lists each fund, deceased name, due date, status, recorded payments, applied credit and outstanding amount; exemptions and unpaid late fees awaiting assessment are explicit. It separates overdue amounts from other outstanding funds and shows unapplied credit separately. Review balances are excluded and labelled incomplete rather than quoted as verified debt. Payment history includes statuses, so dismissed/reversed entries do not look like confirmed receipts. A requested statement does not assess fees or change money records. The email action is timestamped in Overview; uncertain sends require inspecting sent mail and the audit before retrying.

## Overview

The original top numbers remain visible across workspace tabs. Overview shows confirmed fund contributions, available credit separately, current member count, review-row count, seven-day contribution bars, fund breakdown, recorded receipt-email status and recent confirmed actions. Select a fund bar to open its balance. Activity contains time, dashboard section of origin, task, outcome and reference. No IP addresses, device information or clickstream are collected. It does not claim to identify who used a shared dashboard. Earlier actions remain in their original logs.

## Contributions & Zelle review

Use the payment table to inspect memo, status and recorded email state. Select **Fix / allocate**, confirm the member and fund dropdowns, enter exact split amounts, preview, then confirm. Splits plus explicit future credit must equal the source amount. Dismiss applies only to unresolved sources; confirmed receipts are protected. Available credit can be applied from the member’s Fund obligations tab without recording cash again.

Bank inspection supports today, yesterday, this week, last week, this month and custom periods. Review every page; counts cover the displayed conversation page. Inspection is read-only. A missing bank email can be staged as one unresolved source after its own preview/confirmation, with duplicate/checkpoint checks. No payment is applied merely by inspecting or staging it.

Fund numbers never become member IDs: `Fund 010 and 011 from member MW0056` identifies MW0056, not MW0010/MW0011. A surname such as Chimphonda may describe more than one fund; matching fund names are alternatives for review. Do not run the James Chilambe correction code in the supplied legacy email. Apparent duplicate or wrong-destination confirmed rows need verified source review; the dashboard does not automatically reverse them.

## Fund balances & payouts

Select a fund, read the balance and calculation breakdown, then use the paid/unpaid member list directly below it. Filter all, paid/credit-covered, unpaid/partial or review; CSV exports the complete selected fund roster. Names open profiles. Print/save PDF retains the calculation report. **Record a payout** records money already sent and its reference; it does not send bank money. Preview first and confirm only the reviewed record.

## Guided administration

- **Consolidated reminders:** enter selected IDs, preview each full email and confirm. One message per member; same-day reminder-log entries are held.
- **Late fee management:** choose a fund and selected members; preview exact cells before/after. Only a verified unpaid $5 fee can be reversed. No paid-fee refund or new stored credit is inferred.
- **4+ missed funds:** review selected final warnings and their existing template before sending. Warning eligibility alone never removes someone.
- **Remove members:** requires a sent final notice, expired deadline, remaining notified arrears, Board approval/reference and opportunity for the member to present their case. Archive precedes MEMBERS deletion. PAYMENTS/TRACK remain; the member receives appeal contact information. This does not remove them from WhatsApp.
- **Removed-member cleanup:** dated removal record and absence from MEMBERS required. Preview unpaid TRACK rows, archive first, then delete only reviewed rows. Paid/applied-credit history is retained to protect fund totals. Regenerate your pending report afterward with its existing function.
- **Meeting slides:** preview active funds; confirmation runs your existing deck generator and its leadership notification.
- **Open fund:** one claimant, exact declared beneficiary, no previous/possible claim, verified registration/arrears review, Welfare/Board evidence and 14-day deadline. Preview all included tracker rows and stored-credit effects. The six officers and claimant are exempt; Board membership alone is not. Only eligible non-exempt members’ disclosed stored credit is applied. New fund creation does not rebuild any old tracker or create a cash receipt. Shared-loss cases need separate review.
- **Board badges:** selected confirmed IDs only; display changes do not grant contribution exemptions or payment permissions.

Every workflow starts with a dry run. A changed source invalidates the preview. Completed request IDs do not repeat on retry; interrupted or uncertain administrative requests stop for review rather than replay partial work. Check MW_ADMIN_ACTIONS, financial journals and the relevant source sheet when a task reports uncertainty.

## Profiles and financial standing

Profiles show joined date, emergency contact, officer/Board badges, registration confirmation, obligations, payments, beneficiaries and claimed funds. A prior declared-person claim shows fund number and opening date; uncertain name matches are held for identity review. Ongoing funds within their deadline do not count as overdue arrears. Any verified overdue arrears hold benefits; two show At Risk and three or more Ineligible. Enrollment window, beneficiary declaration before loss and restoration history still require evidence for claim approval.

Confirmed deputy badges: Nellie Yobe Bakuwa (MW0031), Deputy President; Dr Gift Ligomeka (MW0324), Deputy Treasurer; Vincent Saka (MW0369), Deputy Secretary. Board roster uses the 13 supplied IDs. Officer exemption does not extend to spouses.

## Restored table controls and collection status

The original registration member list is available within Registration & members. Click headings to sort. Filters and CSV/PDF exports operate on the full matching member list. Select the checkboxes, then Bulk Reminder to preview separate balance statements for up to 20 members. Nothing is sent by selecting the rows.

Fund member lists support name/ID search, paid/partial/unpaid/review filters, sorting, matching CSV/PDF exports and selected-member consolidated reminders. Review balances are excluded from verified outstanding totals. Contribution payment exports include all matching records in the selected sort order; they require this matching server update.

A fund displays Closed once its due date has passed, stays visible in Funeral funds, and remains available for historical payments and payouts. The Active count includes only funds still within their collection window. The due date itself remains part of the open window.

Profiles show available details immediately. Family names remain visible while separate claim checks load; an unavailable claim check is never treated as proof that there were no claims. The payment timeline includes registration receipts. Older financial records are not automatically reconciled while opening a profile.

## Interactive daily work — v3

Zelle and contribution review comes first, followed by the registration member table. Recent payments has its own tab. Open a member name for their profile or Inspect for the exact ledger row. The Overview cards, daily/monthly charts, credit totals and action references drill into their records.

**Check a payment claim:** Daily work → Check member payment records → enter one or more IDs → Check selected members. Inspect posted payment rows, fund obligations and other memo rows mentioning those exact IDs. This is a read-only replacement for editing the hardcoded IDs in checkMembers(); none of that file’s fix functions run.

**Resolve an unmatched payment:** allocate directly from its source row, preview exact shares, then confirm. The original source is automatically dismissed and excluded; posted child rows receive branded contribution receipts. If the money was already entered manually, use Already posted? Link existing payments, select its posted ledger rows, verify the intended member/fund split and preview. This resolves the source without recording cash twice.

**Recover an email:** Inspect a confirmed payment or open its member payment history → Send unsent receipt. Check the HTML preview and recipient, then confirm. An uncertain/sending status requires checking sent mail first. Already-sent and reversed receipts are held. A saved financial transaction is never replayed to resend an email.

**Reverse an erroneous contribution:** open the exact payment’s Reverse payment action, enter a reason and preview every affected value. The workflow requires consistent ledger/tracker/fund totals and one original fund-log match. It preserves history and restores only the reversed contribution’s balance; no money is refunded through the bank. Registration and unspent-credit reversals require verified balances; ambiguous or already-used credit remains held. For a verified unpaid $5 fee, choose Reverse late fee from Fund obligations.

**Fund reports:** Daily work → Fund status reports → choose fund and Full/Pending-only → preview → confirm email to leadership. **Quarterly reports:** choose year, quarter and written Doc/PDF or optional meeting deck. The quarter’s receipts and outflows use the actual ledger dates. The optional deck is cumulative, separately labelled. Open the returned report/download links from the result panel.


## Member follow-up and mobile update

A read-only banner loads with the dashboard. Four or more verified overdue funds trigger a warning flag. Exemptions, paid/credit-covered funds and not-yet-due funds do not count. Sent warnings show their response deadline. After that date, remaining debt on the originally notified obligations triggers **Removal review needed**. Payment or applied credit resolves that notice; newer unrelated debt does not keep it open. Warning emails and Board-approved removal still require a preview and confirmation. Existing sent or uncertain delivery audits prevent blind repeat warnings. Run the separate archived cleanup preview after removal; paid and applied-credit history is preserved.

In Admin workflows choose **Set registration alert window** and enter the actual start and end dates. Fee alerts remain inactive until dates are configured and the window closes. They apply only to members who joined in that cohort, use verified registration cash/prior credit, and have their own warning message and response deadline. This setting does not open/close the registration form or rewrite payment records.

Mobile navigation scrolls within the tab bar. Tables with headings become labelled records, inputs stack, the profile drawer fills the screen, actions have touch-sized targets, and wide content stays inside its panel. Dark and light themes retain the existing colors. Synthetic layout/label checks pass; installed mobile-browser appearance remains to be checked.

**Missed registrations:** scan in Registration & members, then choose **Recover selected missed registrations** and enter the exact row numbers. Preview assigns IDs above the known historical maximum, archives original rows, and preserves all financial cells, family details and existing IDs. Duplicate/shared emails and same-name records require review. No welcome email is sent by recovery; preview selected welcome resends next.

The supplied original `onFormSubmit` is not replayed: it assigns a new ID even for an existing row, scans only current IDs, and clears credit / writes a numeric credit into the registration-status column. Its duplicate-email comparison also reads column A rather than B. This addon leaves that original handler unchanged. **Correct and test that original intake handler before opening the new registration form**; dashboard recovery does not fix the installed form trigger. The dashboard resend action uses a separate HTML message, tracks uncertain sends and preserves IDs/credit.


## Financial reports

Open Financial reports, choose a view, and set the cash activity dates. Fund performance and fund calculations retain current balances. Click a fund or calculation amount for supporting entries. Use Payouts/refunds/expenses for category and quarterly totals. Member balances supports search, highest-balance/name/overdue sorting, 4+ overdue filtering and warning-review links; no warning is sent from the matrix. Phone users expand a member card. CSV exports all matching rows. Select Board report package and Print / save PDF to include fund explanations, outgoing totals, review notes and the current owing-member matrix. The report is not a bank balance or a reconstructed historical member ledger.
