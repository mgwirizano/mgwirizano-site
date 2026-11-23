const fs=require('fs'),vm=require('vm'),assert=require('assert'),{env}=require('./test-admin.cjs');
function example(){const e=env();e.data.FUNDS[3][2]='Irene Mtileni';e.data.PAYMENTS[12][3]=100;e.data.PAYMENTS[12][9]='MW0083 MW0100 Mtileni. Extra funds for future contributions.';return e;}
{
 const e=example(),d=e.c._mwAdminSuggest_({sourceRow:13}),p=d.proposal,r=p.accountReview;assert(p.creditReviewRequired);assert(!p.canPreview);assert(!p.lines.some(a=>a.fundCode==='CREDIT'));assert.equal(p.proposedCredit,0);assert.equal(p.difference,70);assert.equal(p.lines.length,2);assert(p.lines.every(a=>a.fundCode==='FUND-011'&&a.amount===15));assert.equal(r.members.length,2);assert(r.members.every(m=>m.funds.length===3));assert(r.otherBalances.some(o=>o.memberId==='MW0100'&&o.fundCode==='FUND-009'&&o.overdue));assert(r.otherBalances.some(o=>o.fundCode==='FUND-010'&&!o.overdue));assert(!r.members[0].funds.find(o=>o.fundCode==='FUND-009').overdue);assert.equal(e.writes(),0);assert.equal(e.emails(),0);
 const inspect=e.c._mwPrRoute_({action:'fp_review_source',sourceRow:13},'test');assert(inspect.inspection.proposal.creditReviewRequired);assert.equal(inspect.payment.amount,100);assert.equal(e.writes(),0);assert.equal(e.emails(),0);
}
{
 const e=example();e.data['TRACK-009'][8][4]=0;e.data['TRACK-009'][8][7]='EXEMPT';for(const i of [7,8]){e.data['TRACK-010'][i][4]=0;e.data['TRACK-010'][i][7]='EXEMPT';}let p=e.c._mwAdminSuggest_({sourceRow:13}).proposal;assert(!p.accountReview.creditNeedsReview);assert(p.canPreview);assert.equal(p.proposedCredit,70);
 e.data['TRACK-010'][7][4]=10;e.data['TRACK-010'][7][7]='PENDING';e.c.MWPR_READ_CACHE={};p=e.c._mwAdminSuggest_({sourceRow:13}).proposal;assert(p.creditReviewRequired);assert(!p.canPreview);assert(!p.lines.some(a=>a.fundCode==='CREDIT'));assert.equal(e.writes(),0);
}
{
 const e=example();e.data['TRACK-010'][7][5]=5;const p=e.c._mwAdminSuggest_({sourceRow:13}).proposal;assert(p.accountReview.issues.some(x=>x.includes('FUND-010')));assert(!p.canPreview);assert(!p.lines.some(a=>a.fundCode==='CREDIT'));assert.equal(e.writes(),0);
}
{
 const source=fs.readFileSync(__dirname+'/../MW_PaymentReview.js','utf8').split('(function mountPaymentReview(){')[0],c={console,Date,Map,fpEscape:v=>String(v??'').replace(/</g,'&lt;'),fpMoney:v=>'$'+Number(v||0).toFixed(2)};vm.createContext(c);vm.runInContext(source,c);const e=example(),r=e.c._mwAdminSuggest_({sourceRow:13}).proposal.accountReview,html=c.mwAccountReviewHTML(r);assert(html.includes('all funds'));assert(html.includes('OTHER UNPAID FUND'));assert(html.includes('FUND-009'));assert(html.includes('FUND-010'));assert(html.includes('No payment, credit or email changes'));assert(source.includes('inspection:d.inspection'));
}
console.log('PASS: Inspect checks all funds for both IDs, identifies other overdue/upcoming balances and unverified records, suppresses future credit without moving money to unnamed funds, and rechecks before suggestion fill. Clear all-fund accounts can still propose credit. Paid funds are not labelled overdue. Zero writes/emails.');
