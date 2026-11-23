# Website speed update — v4.6

Already on v4.4: replace **MW_PayoutDashboard.js** and **MW_PaymentReview.js** on the website, then hard-refresh. No Apps Script changes, redeployment or automation changes are needed. This update includes the v4.5 compact callout lists and timed success messages. The compatible server version remains 2026-11-22.4.4.

## Changes

- The hidden contribution list loads when its tab is first opened, instead of competing with Overview during startup. Membership alerts are still loaded automatically, after the initial overview request settles.
- Concurrent identical safe read requests share one network call. Fund catalog display data is reused for up to 30 seconds and Overview data for up to 15 seconds on tab switches. The Overview Refresh button bypasses its display cache.
- Writes invalidate display caches before and after the request, including failed/uncertain outcomes. Responses from reads started before a mutation cannot repopulate the new cache. Read results are cloned so a caller cannot alter another caller's result.
- Payment previews, confirmations, source inspection, memo suggestions and report status checks are never cached by this optimization. Live balances and posting checks remain server-side and fresh.
- Inspect's fresh response already contains account checks; the drawer reuses it immediately instead of requesting the same full check again. Use suggestions still obtains a fresh server check before filling.
- Mobile labels update only for added/changed tables. Toast/progress updates no longer cause a whole-page table scan.

Synthetic tests verify request counts, write invalidation, stale in-flight protection, no caching of financial previews/suggestions, local table labeling and reused Inspect responses. These show less redundant work; they are not a measured promise of live load time. Actual Apps Script/Gmail latency and large-workbook scans still depend on the installed project. Server-side ledger indexing is a separate potential improvement; this update does not change financial calculation code.

No live deployments, scans, payments, emails or triggers were run.
