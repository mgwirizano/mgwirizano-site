# Member alerts performance fix and top Admin shortcut — v4.8

This update includes a server-side correction. Updating the website alone will not fix the expensive alert calculation.

## Install

1. In the existing Apps Script project, replace **MW_Dashboard_Operations.gs** and **MW_Dashboard_Actions.gs**. Save and deploy a new version of the SAME web app, keeping its existing /exec URL and main doGet/doPost bridge.
2. On the website, replace **MW_PayoutDashboard.js** and **MW_PaymentReview.js**. Hard-refresh the dashboard. No new script tag, trigger or automation setting is needed.

## What changed

The top shortcut row now includes Admin workflows. It opens the existing Admin workspace, scrolls to it and focuses the task selector. Repeated mounting does not add duplicate buttons.

Member alerts previously rebuilt the complete PAYMENTS ledger for each sent warning under review. Registration notice checks repeated the registration-wide scan as well. The alert check now shares a single fresh request-local ledger snapshot, registration calculation, notice index and notice audit. No data is cached across server requests.

The old cleanup count built a full executable cleanup plan and read formulas from every tracker. Alerts now use a read-only count of eligible removed-member rows, preserving the same dated-removal and paid/credit-history protections. Actual cleanup still requires its separate fresh preview, archive and confirmation.

A synthetic fixture with 40 sent funeral/registration notices produces identical alert decisions and cleanup counts. Ledger rebuilds fall from 42 to 1, and tracker formula reads from 3 to 0. No sheets or emails change during alert loading. The existing four-fund threshold, registration window, original notice deadlines and exclusion protections remain.

The prior nonblocking UI fixes are retained. This targets an expensive server path behind the timeout banner; live deployment timing still needs verification after installation. It does not change the read timeout to conceal a slow or failed request.
