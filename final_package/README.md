# Mgwirizano Watsopano — Full Platform

## Deploy checklist
1. Upload all HTML files + CNAME to GitHub repo → enable GitHub Pages
2. Paste MW_WebApp.gs into Apps Script → save → deploy new version
3. In FuneralFundAutomation.gs, add to scanZellePayments() end: _mwRecordScannerRun(processed);

## New features in this version
- Dashboard: WhatsApp funeral fund message generator (💬 button)
- Dashboard: Manual payment entry fallback (+ Manual Pay button)
- Dashboard: Scanner health monitor (right panel)
- Dashboard: Pending member update requests (right panel, appears when there are requests)
- Member portal: Update Details tab (phone, location, emergency contact)
- GS: scanner_health, manual_payment, update_member, whatsapp_message, pending_updates, approve_update actions

## Supabase migration
See comments at top of MW_WebApp.gs for free database migration guide.
Run when membership exceeds 400.

## Free stack
- GitHub Pages: hosting (free)
- Google Apps Script: backend logic (free)
- Google Sheets: database (free until ~400 members)
- Brevo: email 300/day (free)
- Cloudflare: DNS + email routing (free)
- Supabase: future database (free tier = 500MB)
