# v4.9 — alert read fix and approved light palette

## Install from v4.8
1. Replace the entire MW_Dashboard_Operations.gs addon with the enclosed file. Do not create a second copy with duplicate functions.
2. In Apps Script, update the existing web-app deployment to a new version. Keep the same web-app URL. Saving the editor alone does not update a deployed version.
3. Replace website MW_PaymentReview.js and hard-refresh the browser.

From v4.7 or earlier, use all eight enclosed GS addons and both JS files, retaining the existing dispatch installation described in INSTALL.md. Do not replace doGet or credential-bearing main bridge files.

## What changed
The original alert decisions remain: four or more overdue funds, separate registration-window checks, and deadline review based only on the original sent notice. The early version already used these rules; blindly restoring its entire file would remove later bank-check features and reintroduce expensive repeated reads.

The alert request now uses a fresh request-local read snapshot. Spreadsheet timezone and sheet handles are reused instead of calling Google Sheets for every payment date and member/fund check. The v4.8 optimization alone reduced ledger parsing but left these service calls in place. The browser's 30-second read timeout can expose that remaining cost. The screenshot proves a timeout, not its full live cause; this patch addresses the reproduced code bottleneck.

A synthetic fixture with 4,000 additional dated payment rows returned identical alert output while reducing timezone service calls from 4,009 to 7. Earlier 40-notice comparisons still match the original implementation. No persistent result cache, stale cross-request balances, automatic emails, removals or financial changes were introduced. Request-local state is restored even after a failed read. Live response time is not yet verified.

Light mode uses ivory pages, warm white cards, forest-green active tabs, sage borders and headings, champagne breakdown cards, rose outstanding cards and blue active-fund cards. All added color rules require light mode. Layout and dark-mode styling are unchanged. Browser appearance has not been visually verified here.

If the error persists after deploying the new Apps Script version, capture the failed execution duration/error in Apps Script Executions. An unchanged deployment URL alone does not confirm that the new version is running.
