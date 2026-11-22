# Clickable member profiles and claimed-fund history

Install on top of the dashboard operations update:

1. Replace the existing Apps Script file MW_Dashboard_PaymentReview with the included version. Add MW_Dashboard_Claims as a new Apps Script file.
2. Replace the two existing website files MW_PayoutDashboard.js and MW_PaymentReview.js. Keep the same script tags and load order.
3. Update the same Apps Script deployment to a new version, publish the website files, then refresh.

Click the member name in payment lists, member lookup, fund-member reports or the claiming-member label on fund cards. The same slide-out profile now has Profile details, Fund obligations, Payments, Beneficiaries and Claimed funds tabs.

FUNDS columns C (deceased), D (fund opening date), I (status), K (relationship), and L (claiming member ID) supply claim history. The module reads these records only. Dates are labelled Fund opened because a separately verified claim-submission date or date of death is not supplied in this schema. Missing dates remain Date not recorded.

Each declared beneficiary is checked using the member ID, normalized full name and relationship. An existing ACTIVE or CLOSED fund linked to the same member/name/relationship shows Not qualified — previously claimed, with fund number and fund opening date. The Claimed funds tab retains history even if the member’s family list later changes. Cancelled/unrecognized fund states require review rather than automatically confirming a claim.

Possible name matches under another member, changed parent/spouse names or abbreviated identities are marked for identity review. Names alone cannot distinguish every person, and the schema has no unique beneficiary identifier. No previous claim found does not mean eligible; the module does not decide membership standing or benefit coverage. The supplied profile update does not modify or block the separate onFundRequestSubmit handler; a new-claim submission guard would need integration there to enforce prevention across that flow.

No payment, tracker, family declaration, claim record or eligibility field is written. Existing preview/apply tools are unchanged. Tests use synthetic records; live display still needs checking after installation.
