# Modern leadership dashboard

Replace only the two existing website files:
- MW_PayoutDashboard.js
- MW_PaymentReview.js

Keep their current script tags and load order. No Apps Script changes or redeployment is needed for this layout update. Publish through the normal website deployment, then hard-refresh the dashboard.

The existing navy, green, gold and red palette is retained. The desktop layout places the main payments / payouts workspace on the left, with funeral capacity, fundraiser cards and existing reports on the right. Member lookup stays above the workspace tabs. Narrow screens stack the sidebar below the workspace. Payout entry is collapsed until opened; switching tabs retains entered values and previews. The header stays in normal flow so it cannot cover the member lookup.

Due dates and claiming members remain on each fundraiser card. All backend files and financial calculations are unchanged. All existing submit, preview, confirmation and profile functions remain connected. The original HTML is retained; this update moves existing interface nodes and adds scoped visual styling. No historical data or live money was changed while preparing it.
