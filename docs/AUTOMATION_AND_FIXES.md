# Dashboard v4.3 — payment review and follow-up

This package contains all existing Financial reports functionality plus the pending click, suggestion, Zelle and operations-follow-up changes. It does not deploy itself or modify production data when downloaded.

## Install once

1. Replace the seven existing `.gs` addons and add **MW_Dashboard_Automation.gs** in the same Apps Script project. The eight `.gs` files in the package root are the complete addon set. Keep your existing main bridge, `doGet`, scanner, email templates and the existing `doPost` dispatch hook. Do not paste another copy of a function with the same name.
2. Replace **MW_PayoutDashboard.js** and **MW_PaymentReview.js** on the website. Save Apps Script and deploy a **new version of the same web app**, preserving its `/exec` URL. Use the existing script tags once each. Refresh the website. The version endpoint now reports `2026-11-22.4.3`.
3. Open **Contributions & review → Action needed → Refresh cases and setup**. Enter the Gmail address/owned send-as alias and committee email addresses. Preview the settings, review the acknowledgment example, then confirm. Enable each email option separately. Setup installs the hourly trigger; setup itself sends no email or financial correction. Leave all email switches off while checking a copied workbook.

The executing account must own the monitored mailbox or its Gmail send-as alias. Forwarding mail to a different account alone is not enough to establish this. The hourly trigger runs under the account that creates it. Use one designated automation account. Existing Google authorization for Gmail and creating Apps Script triggers may be needed. Keep the existing project scopes; add the Gmail/Script trigger scopes if your project explicitly lists scopes and lacks these capabilities.

## What changed

- Buttons show a running spinner, disable related controls and show a persistent process message. Long reports show elapsed time and ask the operator to wait. A browser timeout is not treated as proof the server stopped.
- Full Status and Pending-All-Funds buttons now use the existing report generators through the audited POST workflow. Generators, recipient and report content are preserved. Both report bridge functions must already exist: `generateFundReportForDashboard` and `generatePendingReportForDashboard`. A missing helper gives an error before generation.
- Report requests have a server-side scope reservation independent of request IDs. Running/uncertain work cannot be replayed by a second click, another tab or another operator. A completed same-scope report is reused for two minutes. Refresh restores the local pending reference and checks server status; it does not generate again. Uncertain outcomes require action-audit/sent-mail investigation before any reservation is cleared. There is no automatic retry.
- Group memo suggestions retain all known member IDs. For the $100 example, with two verified $15 balances and an explicit future-credit instruction, the editable proposal is $15 to each fund plus $35 credit each. This equal credit split is a proposal for the reviewer, not a deduction that the memo states an exact split. The button fills a fresh proposal and opens the normal dry run; confirmation still records money. Odd-cent remainders, unknown IDs/funds, ambiguous names and unclear amounts remain held. Simple explicit `$10 each` partial payments to one identified fund are supported.
- Common MW spacing, O/zero and excess-leading-zero variants normalize against the roster. Short M/MM prefixes are possible-ID hints requiring verification. No fund number is treated as a member number.
- When exact member/fund/manual-entry evidence suggests a transfer was already posted, the hint prepares **link existing payments and dismiss unmatched**. Exact source linkage and conservation are required; matching a name or amount alone does not dismiss anything. Normal confirmed allocations automatically dismiss their original unmatched source.
- **Run Zelle check** compares configured bank notices with PAYMENTS, TRACK and individual fund payment logs. Registration receipts are recognized separately. Exact bank/source links take priority over nearby unrelated payments. Missing, duplicate, inconsistent and uncertain cases are displayed with inspection/staging controls. The findings email has its own preview/confirmation and repeat guard.
- Financial reports remain available: fund calculations and evidence, current member balances, quarterly cash activity, outgoing categories, board print, CSV and PDF views. The compact glass summary and mobile styles remain included.

## Optional hourly operations assistant

The default is **disabled**, with every email switch off. After explicit setup, each run can:

1. Track unresolved PAYMENTS rows in **MW_SERVICE_CASES**.
2. Check 10 members' tracker/ledger obligations per run, rotating through the roster, and open consistency-review cases. This reads records; it never reconciles or rewrites them.
3. Check up to 25 inbox conversations per run from registered member email addresses, processing only messages received since activation. Paged cursors rotate through additional conversations. Unknown senders, bank/system notices, mailing lists and automatic replies do not receive acknowledgments. Committee replies are recognized only when visible in the monitored Gmail thread and from the configured team/owned addresses.
4. With the acknowledgment switch enabled, send one HTML acknowledgment per new member conversation. The case is reserved before sending. A sending/uncertain outcome is never automatically retried. Acknowledgments are not counted as human responses. A new member reply reopens follow-up, without sending another automatic acknowledgment in the same thread.
5. Check one page of up to 50 bank conversations in a rolling seven-day period. Continue on subsequent runs and show the latest period/page cursor. This detects missing **email-backed** records; it is not a bank-statement reconciliation. Use the manual date controls for older periods and verify the actual bank statement for payments with no bank email.
6. Track first-response and correction targets separately (defaults 48 and 72 hours; editable). A human reply closes a general member-email case, but **does not close a payment investigation**. Original payment-review rows close when their ledger source is resolved; bank/query cases require reviewed resolution when evidence remains ambiguous.
7. With the digest switch enabled, email leadership one exceptions digest per calendar day, including open cases, overdue replies/corrections, warning/removal-review alerts and scan errors. Newly arising items remain visible on the dashboard and are included in the next daily digest. Send acceptance is not proof of inbox delivery.
8. With the contribution-reminder switch enabled, check a rotating group of 10 members per run for funds due within two days or overdue. Send at most one reminder per member per 72 hours, checking this assistant's send history and the existing REMINDER LOG. Hold open payment disputes, unknown-payer bank investigations, inconsistent balances and incomplete/failed inbox or bank checks. Registration final notices and formal four-fund warnings remain reviewed actions.

**MW_SERVICE_MAIL_AUDIT** reserves digest/reminder sends before calling the existing `sendEmail` wrapper. A recorded `SENDING` or `UNCERTAIN` outcome requires review of sent mail; rerunning does not send another copy. The assistant never sends a bank transfer, changes payment amounts, applies late fees, removes members or deletes TRACK rows.

The dashboard can preview a check without saving cases/emails and can preview/confirm one run using the saved switches. Assign owners, add notes and resolve reviewed cases in the queue. A case-resolution note is not a financial correction. Open payment disputes block formal warning/removal actions until reviewed; unassigned bank investigations hold these actions conservatively until their member/transaction is established.

## Queries received on WhatsApp or by phone

Use **Log a WhatsApp / phone payment query**, enter the member ID and query summary, preview and confirm. This creates a follow-up case without sending a message or changing money. The assistant does not read WhatsApp. Reply in the original channel and record the reviewed outcome. Do not close a payment dispute solely because someone was told “we are checking.”

## Acknowledgment wording

> Thank you for contacting [group]. Your message has been received and logged for leadership review. Reference: [case]. We aim to provide a first response within [configured hours]. Payment investigations can take longer; leadership will be alerted if the review remains open. This acknowledgment does not confirm receipt, allocation or correction of a payment. If you are querying a payment already made, please do not pay it again solely because it appears outstanding. Reply with your Member ID, fund, payment date, amount and bank reference, if these were not already included. Do not send passwords, account numbers or a full bank statement.

## Verification and limits

Synthetic tests exercise financial conservation, duplicate requests, interrupted/uncertain reports, zero-write previews, group credits, member-ID variants, Zelle classification, acknowledgment loops, reply-versus-correction tracking, disabled defaults and email deduplication. No real email, bank scan, trigger installation, membership removal or production ledger change was run during development. Live Gmail routing, authorizations, quotas, browser appearance and delivery require an installation check. Jobs are bounded and page-scoped: the dashboard does not claim every historical record was checked in one run.

Previous installation notes about the original registration form handler still apply. This update does not repair or replace that original `onFormSubmit` handler. Do not enable a new registration intake on the assumption that this addon fixes the original handler's ID/credit logic.
