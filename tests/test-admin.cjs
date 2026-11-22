const fs=require('fs'),vm=require('vm'),assert=require('assert'),{setup}=require('./test-payment-review.cjs');
function env(){const e=setup(),ss=e.c.getSpreadsheet();const baseGet=ss.getSheetByName,baseInsert=ss.insertSheet;let deleted=0,emails=0;
 function decorate(sh){if(!sh||sh.decorated)return sh;sh.decorated=true;const getRange=sh.getRange,getData=sh.getDataRange;sh.getRange=(...args)=>{const r=getRange(...args);r.getValue=()=>r.getValues()[0][0];r.setValue=v=>r.setValues([[v]]);return r;};sh.getDataRange=()=>({...getData(),getFormulas:()=>e.data[sh.getName()].map(r=>r.map(()=>''))});sh.deleteRow=row=>{deleted++;e.data[sh.getName()].splice(row-1,1);};return sh;}
 ss.getSheetByName=n=>decorate(baseGet(n));ss.insertSheet=n=>decorate(baseInsert(n));ss.getSheets=()=>Object.keys(e.data).map(n=>ss.getSheetByName(n));
 e.c.getSettings=()=>({regFee:25,leaderEmail:'leader@example.test',groupName:'Test',zelleEmail:'zelle@example.test'});e.c.Session={getScriptTimeZone:()=> 'America/Chicago'};e.c.sendEmail=()=>{emails++;return true;};
 for(const n of ['MW_Dashboard_Claims.gs','MW_Dashboard_Operations.gs','MW_Dashboard_Admin.gs'])vm.runInContext(fs.readFileSync(__dirname+'/../'+n,'utf8'),e.c);return {...e,ss,deleted:()=>deleted,emails:()=>emails};}
{
 const e=env();e.data.MEMBERS[1][12]='Emergency 555-0101';let d=e.c._mwPrProfile_('MW0083');assert.equal(d.emergencyContact,'Emergency 555-0101');assert.equal(d.adminStatus.overdueFunds,1);assert.equal(d.adminStatus.benefits,'ON HOLD');
 e.data.FUNDS[3][9]=new Date('2031-01-01');e.data.FUNDS[3][8]='ACTIVE';d=e.c._mwPrProfile_('MW0083');assert.equal(d.adminStatus.overdueFunds,0);assert.equal(d.adminStatus.ongoingUnpaidFunds,2);assert.equal(d.adminStatus.displayStatus,'ELIGIBLE FINANCIAL STANDING');assert.equal(e.writes(),0);
 for(const [id,role] of [['MW0031','Deputy President'],['MW0324','Deputy Treasurer'],['MW0369','Deputy Secretary']]){const d=e.c._mwAdminProfile_({id,raw:e.data.MEMBERS[1]},e.c._mwPrLedger_(),[]);assert(d.roles.some(r=>r.position===role));assert(d.roles.some(r=>r.body==='Board'));}
 assert.equal(e.c.MW_ADMIN_BOARD_IDS.length,13);assert.equal(e.c._mwPrEmailState_('NOT SENT'),'NOT SENT');assert.equal(e.c._mwPrEmailState_('YES — 11/20/2026'),'SENT (RECORDED)');assert.equal(e.c._mwPrEmailState_('SENDING...'),'SENDING — VERIFY');
 const roster=e.c._mwPrFundView_('FUND-010');assert.equal(roster.stats.rows,2);assert.equal(roster.stats.unpaid,2);assert.equal(roster.stats.confirmedCash,0);
}
{
 const e=env(),input={task:'LATE_APPLY',memberIds:['MW0083'],fundCode:'FUND-011',reason:'Past deadline verified',requestId:'admin-late-123456789'};
 const plan=e.c._mwAdminPlan_(input);assert.equal(e.writes(),0);assert.equal(e.emails(),0);assert.equal(plan.details.operations[0].after[0][0],15);
 const result=e.c._mwAdminApply_({...input,previewToken:plan.token,confirmed:'YES'});assert.equal(result.status,'ok');assert.equal(e.data['TRACK-011'][7][4],15);assert.equal(e.data.PAYMENTS.length,13);assert.equal(e.data.MEMBERS[1][18],25);assert.equal(e.emails(),1);
 const writes=e.writes();assert(e.c._mwAdminApply_({...input,previewToken:plan.token,confirmed:'YES'}).alreadyRecorded);assert.equal(e.writes(),writes);assert.throws(()=>e.c._mwAdminApply_({...input,reason:'Different approval',previewToken:plan.token,confirmed:'YES'}),/different details/);
 const reverse={...input,task:'LATE_REVERSE',requestId:'admin-reverse-1234567'};const pre=e.c._mwAdminPlan_(reverse);e.c._mwAdminApply_({...reverse,previewToken:pre.token,confirmed:'YES'});assert.equal(e.data['TRACK-011'][7][4],10);assert.equal(e.data.MEMBERS[1][18],25);
}
{
 const e=env();e.data['REMOVED_MEMBERS']=[['Member ID','Removed At'],['MW0999',new Date('2026-01-01')],['MW0083',new Date('2026-01-01')]];
 for(const n of ['009','010'])e.data['TRACK-'+n].push(['MW0999','Removed',10,0,10,0,'','PENDING','']);e.data['TRACK-011'].push(['MW0999','Removed',10,0,0,10,'','PAID','']);
 const input={task:'CLEANUP',requestId:'cleanup-12345678900'},p=e.c._mwAdminPlan_(input);assert.equal(p.details.targets.length,2);assert.equal(p.details.held.length,1);assert(p.details.retainedStillMembers.includes('MW0083'));assert.equal(e.writes(),0);assert.equal(e.deleted(),0);
 e.c._mwAdminApply_({...input,previewToken:p.token,confirmed:'YES'});assert.equal(e.deleted(),2);assert.equal(e.data['REMOVED FUND ROWS ARCHIVE'].length,3);assert(e.data['TRACK-011'].some(r=>r[0]==='MW0999'));assert.equal(e.data.PAYMENTS.length,13);assert.equal(e.emails(),0);
}
{
 const e=env(),input={task:'LATE_APPLY',memberIds:['MW0083'],fundCode:'FUND-011',reason:'Review complete',requestId:'stale-admin-123456789'};const p=e.c._mwAdminPlan_(input);e.data['TRACK-011'][7][4]=5;assert.throws(()=>e.c._mwAdminApply_({...input,previewToken:p.token,confirmed:'YES'}));assert.equal(e.writes(),0);assert.equal(e.emails(),0);
 const period=e.c._mwAdminPeriod_({period:'LAST_WEEK'});assert(period.start<=period.end);assert.throws(()=>e.c._mwAdminPeriod_({period:'CUSTOM',start:'2026-02-30',end:'2026-03-01'}));
}
{
 const e=env();e.data.PAYMENTS[12][9]='Owing from fund 008 to 011 No 83 Test Member';const s=e.c._mwAdminSuggest_({sourceRow:13});assert(s.possibleMemberIds.includes('MW0083'));assert(s.fundCodes.includes('FUND-009'));assert(s.fundCodes.includes('FUND-011'));assert.equal(e.writes(),0);
}
console.log('PASS: read-only standing/emergency/role badges; ongoing versus overdue; 13 confirmed Board IDs; recorded email states; per-fund statistics; targeted fee apply/reversal; no paid/credit modification; repeat-safe and stale preview checks; archive-before-cleanup; current members and paid history protected; calendar periods; memo hints without automatic allocation.');
{
 const e=env(),input={task:'REMINDERS',memberIds:['MW0083'],requestId:'reminder-one-12345678'};
 e.c.emailHeader=()=>'<h1>Test</h1>';e.c.emailFooter=()=>'<footer>Test</footer>';vm.runInContext(fs.readFileSync(__dirname+'/fixtures/consolidated-template.gs','utf8'),e.c);
 const p=e.c._mwAdminPlan_(input);assert.equal(e.emails(),0);assert.equal(e.writes(),0);assert.equal(p.details.messages.length,1);e.c._mwAdminApply_({...input,previewToken:p.token,confirmed:'YES'});assert.equal(e.emails(),1);assert.equal(e.data['REMINDER LOG'][1][2],'MW0083');assert.throws(()=>e.c._mwAdminPlan_({...input,requestId:'repeat-reminder-1234567'}),/reminder log entry today/);
}
{
 const e=env(),input={task:'BOARD_BADGES',memberIds:['MW0100'],position:'Board Member',requestId:'board-badge-123456789'};const p=e.c._mwAdminPlan_(input);assert.equal(e.writes(),0);e.c._mwAdminApply_({...input,previewToken:p.token,confirmed:'YES'});assert.equal(e.data['LEADERSHIP ROSTER'][1][0],'MW0100');assert(!e.c._mwPrExempt_('MW0100','FUND-011',e.data['TRACK-011'][8],e.data.FUNDS[3]));
 let slides=0;e.c.generateFundSlides=()=>{slides++;return {url:'https://docs.google.com/presentation/d/test'};};const sp=e.c._mwAdminPlan_({task:'SLIDES',requestId:'slides-meeting-1234567'});assert.equal(slides,0);e.c._mwAdminApply_({task:'SLIDES',requestId:'slides-meeting-1234567',previewToken:sp.token,confirmed:'YES'});assert.equal(slides,1);
}
{
 const e=env();e.c._mwNoticeDeadlinePassed_=()=>true;e.c._mwNoticedBalance_=()=>({total:15,funds:[{code:'FUND-011',amount:15}]});e.data['REMOVAL REVIEW']=[['Decision','Member ID','Member Name','Email','Missed Count','Outstanding Funds','System Total','Deadline','Investigation Notes','Last Evaluated','Send Status','Sent At'],['PROCEED','MW0083','Test','member@example.test',5,'FUND-011',15,'2020-01-01','','','SENT',new Date('2019-12-20')]];
 const input={task:'REMOVE',memberIds:['MW0083'],boardReference:'Board case 123',caseReviewed:'YES',requestId:'remove-selected-12345'};
 assert.throws(()=>e.c._mwAdminPlan_({...input,boardReference:''}),/Board approval/);const p=e.c._mwAdminPlan_(input);assert.equal(e.emails(),0);assert.equal(e.deleted(),0);e.c._mwAdminApply_({...input,previewToken:p.token,confirmed:'YES'});assert.equal(e.deleted(),1);assert.equal(e.data.PAYMENTS.length,13);assert.equal(e.data['TRACK-011'].length,9);assert.equal(e.data['REMOVAL REVIEW'][1][10],'REMOVED');assert.equal(e.data['REMOVED MEMBERS ARCHIVE'][1][0],'MW0083');assert.equal(e.emails(),1);
}
{
 const e=env();e.data.FUNDS[2][2]='Chimwemwe Chimphonda';e.data.FUNDS[3][2]='Irene Mtileni';const old=e.data.FUNDS[1].slice();old[0]='FUND-003';old[2]='George Gideon Chimphonda';e.data.FUNDS.push(old);
 const james=e.c._mwAdminMemoHints_('*Fund 010 and 011 from member MW0056*');assert.deepEqual(Array.from(james.memberIds),['MW0056']);assert.deepEqual(Array.from(james.explicitFundCodes),['FUND-010','FUND-011']);assert(!james.memberIds.includes('MW0010'));
 const ambiguous=e.c._mwAdminMemoHints_('MW0329 Chimphonda');assert(ambiguous.ambiguous);assert.equal(ambiguous.nameReferences[0].funds.length,2);
 console.log('PASS: real reminder template; zero-email preview; one selected reminder and same-day hold; Board badges do not grant exemption; slides confirmation; Board-approved selected member removal archives first and preserves financial history; James memo fund numbers never become payer IDs; Chimphonda alternatives remain ambiguous.');
}

{
 const e=env(),input={task:'STATEMENT',memberIds:['MW0083'],requestId:'member-statement-1234567'};
 const p=e.c._mwAdminPlan_(input);assert.equal(e.writes(),0);assert.equal(e.emails(),0);const m=p.details.statement;
 assert.equal(m.total,25);assert.equal(m.overdue,15);assert(m.text.includes('awaiting assessment'));assert(m.text.includes('PAYMENT HISTORY'));assert(m.text.includes('not extend to a spouse'));assert(m.text.includes('Zelle to: zelle@example.test'));
 const result=e.c._mwAdminApply_({...input,previewToken:p.token,confirmed:'YES'});assert.equal(result.result.email.status,'SENT');assert.equal(e.emails(),1);assert.equal(e.data.PAYMENTS.length,13);assert.equal(e.data.MEMBERS[1][18],25);assert.equal(e.data['TRACK-011'][7][4],10);
 e.c._mwAdminApply_({...input,previewToken:p.token,confirmed:'YES'});assert.equal(e.emails(),1);
 assert.throws(()=>e.c._mwAdminPlan_({...input,memberIds:['MW0083','MW0100']}),/one member/);
 e.c._mwAdminLog_('fp_admin_apply',input.requestId,result);const o=e.c._mwAdminOverview_();assert.equal(o.confirmedFuneralCash,10);assert.equal(o.availableCredit,50);assert.equal(o.activity.length,1);assert(o.activity[0].origin.includes('Administration'));assert.equal(e.data['MW_DASHBOARD_ACTIVITY'][1].length,6);
 const uncertain=env();uncertain.data['TRACK-010'][7][5]=20;const st=uncertain.c._mwAdminStatement_('MW0083');assert.equal(st.reviewFunds,1);assert.equal(st.total,15);assert(st.text.includes('not a final complete balance'));
}
{
 const e=env(),member=e.data.MEMBERS[1];member[7]='Declared Father';e.data.FUNDS[1][2]='Other One';e.data.FUNDS[2][2]='Other Two';e.data.FUNDS[3][2]='Other Three';e.data.FUNDS[3][8]='ACTIVE';e.data.FUNDS[3][9]=new Date('2030-01-01');e.data.MEMBERS[1][19]='YES';e.data.MEMBERS[2][19]='YES';
 for(const [id,name] of [['MW0324','Deputy Treasurer'],['MW0002','Board member']]){const r=member.slice();r[16]=id;r[2]=name;r[7]='Different father';e.data.MEMBERS.push(r);}
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()),deadline=new Date(today+'T12:00:00Z');deadline.setUTCDate(deadline.getUTCDate()+14);
 const input={task:'OPEN_FUND',memberIds:['MW0083'],deceased:'Declared Father',relationship:'Father',caseReviewed:'YES',boardReference:'Welfare case 123',evidence:'Verified exact declaration and paid timestamps before loss',deadline:deadline.toISOString().slice(0,10),amount:'10',requestId:'open-new-fund-12345678'};
 const p=e.c._mwAdminPlan_(input);assert.equal(p.details.fundCode,'FUND-012');assert.equal(e.writes(),0);assert.equal(e.emails(),0);assert(!p.details.creditEffects.some(x=>x.memberId==='MW0324'));assert(!p.details.creditEffects.some(x=>x.memberId==='MW0083'));assert(p.details.creditEffects.some(x=>x.memberId==='MW0002'));assert.equal(p.details.trackRows.find(r=>r[0]==='MW0324')[7],'EXEMPT');
 e.c.Utilities.parseDate=(s)=>new Date(s.replace(' ','T')+'Z');const result=e.c._mwAdminApply_({...input,previewToken:p.token,confirmed:'YES'});assert.equal(result.result.fundCode,'FUND-012');assert.equal(e.data.MEMBERS[1][18],25);assert.equal(e.data.MEMBERS[2][18],15);assert.equal(e.data.MEMBERS[3][18],25);assert.equal(e.data.MEMBERS[4][18],15);assert.equal(e.data.PAYMENTS.length,13);assert.equal(e.emails(),1);assert.equal(e.data['TRACK-012'][9][7],'EXEMPT');assert(e.data.EXEMPTIONS.some(r=>r[0]==='FUND-012'&&r[1]==='MW0324'));
 e.c._mwAdminApply_({...input,previewToken:p.token,confirmed:'YES'});assert.equal(e.emails(),1);assert.equal(e.data.MEMBERS[2][18],15);
 console.log('PASS: owing-history statement zero-write preview; separate member privacy; explicit pending fee and incomplete-balance warnings; confirm-only repeat-safe email; no ledger mutations; non-invasive action origin; real Overview totals; new fund numbering, 14-day window, officer/claimant exemptions and disclosed non-officer credit consumption.');
}
