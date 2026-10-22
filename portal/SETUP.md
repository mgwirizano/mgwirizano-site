# Setup and launch

## Start with a pilot copy

1. Make a private copy of the current membership spreadsheet. Use the copy for the pilot.
2. Create a **new standalone Google Apps Script project** called `Mgwirizano Secure Member Portal`. Do not paste these files into the existing election/registration project; its `doGet` and `doPost` remain unchanged.
3. Add `MemberPortal.gs`, `Ledger.gs`, and the HTML file **MemberPortal** from `apps-script/`. The HTML file includes its JavaScript; no separate browser-script file is needed in Apps Script. Copy `appsscript.json` after enabling manifest display in Project Settings.

## Firebase: free authentication only

1. In your organization's Google account, create or select a Firebase project on **Spark**. Do not add billing or upgrade to Blaze.
2. Register a web app and retain its Project ID and Web API Key. These web identifiers are configuration, not administrative secrets. Never share service-account private keys.
3. Under Authentication → Sign-in method, enable Email/Password. Configure a password policy with at least 8 characters. Use the default Firebase email action handler initially.
4. Configure verification and password-reset email templates. Members create their own passwords. Administrators never know or retrieve them.
5. No Firestore database, Firebase Storage, Cloud Functions or Firebase Hosting is needed for this first deployment. GitHub hosts your public site; Apps Script serves the authenticated portal.

## Script Properties

Add these under the NEW Apps Script project's Project Settings:

| Property | Value |
|---|---|
| `PORTAL_SPREADSHEET_ID` | Pilot spreadsheet ID first; production ID only after reconciliation |
| `FIREBASE_PROJECT_ID` | Project ID from Firebase |
| `FIREBASE_WEB_API_KEY` | Firebase web API key |
| `PORTAL_OWNER_EMAIL` | Google account used to own and run this script |
| `PORTAL_ADMIN_EMAILS` | Comma-separated registered member emails for the approved administrators |
| `PORTAL_DOCUMENT_FOLDER_ID` | Private Google Drive folder containing approved PDF copies |
| `PORTAL_LEDGER_ENABLED` | `false` initially |
| `PORTAL_AUTO_APPLY_CREDIT` | `false` until the allocation rule is approved; `true` applies available credit to each newly posted obligation |
| `PORTAL_INGESTION_ENABLED` | `false` initially |

The owner and each administrator must have one unique matching email in MEMBERS. Member ID is column Q, email B, name C, phone D, location E, joined A, as in the current repository. Validate this mapping against the current spreadsheet before launch.

Historical payment mapping: timestamp A, exact Member ID B, amount D, payment type E, fund G, status K. History is displayed without contributing to the new ledger totals. Multi-member payment rows require reconciliation and are not attributed by substring matching.

Run `setupMemberPortal` as the owner. It creates only PORTAL-prefixed tables. It does not delete or overwrite existing sheets.

## Deploy the pilot

Deploy the NEW project as a Web app, executing as the owner, accessible to Anyone. Although the page can load without a Google account, every data operation requires a Firebase-validated, verified-email account linked to a current member. Private helper functions end in `_` and cannot be called by `google.script.run`.

Open the new `/exec` URL. Activate an account using an email present exactly once in MEMBERS, verify its email, then sign in. A browser reload signs out; no refresh tokens or passwords are written to persistent browser storage. The in-memory token refresh supports an open session.

Test with at least two ordinary member accounts and one admin. Check both successful access and denial of cross-member records, board documents and admin actions. Unit tests are not a substitute for these live integration tests.

If email verification expires, sign in and use Resend verification email on the sign-in page; contact the administrator if account recovery is needed. Password-reset emails use Firebase's normal quota. Avoid all-member test mailings.

## Reconcile opening balances before money posting

- Agree on a cutoff and the system that will own balances after it.
- Produce a member-by-member list of genuinely unused credit, unpaid obligations, exemptions and reversals.
- Do **not** treat MEMBERS column P/S as automatically spendable credit. Some prior contribution credits may already have covered registration or funeral funds.
- Do **not** import all historical payments as new PAYMENT events. That would double-count cash and create false credit.
- In the pilot, set `PORTAL_LEDGER_ENABLED=true`, then post confirmed opening credit and each existing unpaid obligation using a unique key. Keep automatic application off until import order and policy are agreed.
- Compare every balance with the existing register. The portal's outstanding/credit metrics are for its own ledger only. With posting disabled they are labeled pending.
- Opening balances need a reconciliation note. Existing ledger entries are preserved; payment corrections use reversals. Subsequent changes to opening credits or charges need an explicitly implemented adjustment workflow, not manual JSON edits.

## Automatic payments and future funds

The ledger already allocates a confirmed overpayment and retains excess as credit. Connecting that operation to the existing Zelle scanner still requires review of the **current scanner code**, which is not included in the GitHub repository inspected for this release.

An optional `PaymentBridge.gs.example` is included. After a successful single-member match, the existing scanner can call this helper with a stable bank reference. The helper sends a timestamped HMAC-signed request to the NEW portal's `doPost`. Configure a random secret of at least 32 characters in both projects; do not put it in GitHub, HTML or chat.

Set `MEMBER_PORTAL_URL` and `MEMBER_PORTAL_SECRET` in the scanner project; set matching `PORTAL_INGESTION_SECRET` and `PORTAL_INGESTION_ENABLED=true` in the portal only after testing. Identical retries return the original receipt. Reused bank references with a new request are rejected. A failed post must remain pending for reconciliation, not be silently discarded.

`scope` can be `advance`, `oldest`, or a particular portal charge ID. The helper defaults to `advance` to avoid inventing an allocation. Select the approved scope in the verified scanner integration. Ambiguous multi-member payments stay in review; this version does not automatically split them.

New obligations must be posted in the portal ledger. The optional auto-credit setting allocates existing credit as each obligation is posted. It does not yet automatically read new FUNDS rows or change TRACK sheets. Before full cutover, implement and test the fund-opening adapter and any required write-back to the current notices/eligibility workflow so a paid member is not chased for a stale TRACK balance.

## Reports and official messages

Upload approved/redacted PDFs into the private document folder. General access must be Restricted; also review explicitly shared users and folder permissions. Publish the PDF file ID via the admin workspace, selecting members or board. PDFs are limited to 5 MB to keep Apps Script responses manageable. The server rechecks the account, audience, folder and file privacy before returning file bytes. No public Drive URL is created.

Messages and enquiry replies appear in the portal inbox. Publishing an announcement does **not** send an email or WhatsApp message. Read acknowledgements are explicit member actions. Document access logs are not proof that the document was read.

## Link from GitHub Pages after the pilot passes

1. Copy `github-members/index.html` and `github-members/config.js` to a new `members/` directory in `mgwirizano/mgwirizano-site`.
2. Set `securePortalUrl` in `members/config.js` to the NEW deployed `/exec` URL. This URL is not a secret.
3. Test `https://mgwirizano.net/members/` and sign in through its button.
4. Update the existing Member Portal navigation to `/members/` only after live verification. The current PR does not change these links or the old `doGet`.
5. Audit and retire or authenticate the old member-data, update and email-resend handlers during cutover. Adding the new login does not protect an older endpoint that still returns member data independently. The repository copy of `MW_WebApp.gs` may not match the deployed version, so review the current deployed source before making those changes.

## Backups, costs and operation

- Keep Firebase on Spark and do not enable paid services.
- Keep periodic private backups of the spreadsheet, documents and script settings in organization-controlled storage. Never commit member exports or secrets to this public repository.
- Protect PORTAL sheets from manual edits by ordinary users. Audit logs are append-only by application convention, not tamper-proof against spreadsheet owners.
- Review Apps Script and Firebase quotas; schedule activations/reset batches if necessary.
- Test recovery and export procedures with the organization's administrators.
- Leave the draft PR unmerged until configuration and integration tests are complete. The private preview is not the production service.
