const fs=require('fs'),vm=require('vm'),assert=require('assert'),{setup}=require('./test-payment-review.cjs');
function ops(){const e=setup();vm.runInContext(fs.readFileSync(__dirname+'/../MW_Dashboard_Operations.gs','utf8'),e.c);e.c.getSettings=()=>({leaderEmail:'leadership@example.test',groupName:'Test',zelleFrom:'no.reply.alerts@chase.com'});return e;}
{
 const e=ops(),p={mode:'DISMISS',sourceRow:13,reason:'Already investigated separately',requestId:'dismiss-request-12345'};
 const pre=e.c._mwPrPreview_(p,'test');assert.equal(e.writes(),0);assert.equal(pre.plan.targets.length,3);
 const apply={...pre.input,previewToken:pre.previewToken,confirmed:'YES'};e.c._mwPrApply_(apply,'test');assert.equal(e.data.PAYMENTS[12][1],'DISMISSED');assert.equal(e.data.PAYMENTS[12][10],'DISMISSED');assert.equal(e.data.PAYMENTS[12][3],40);assert.equal(e.data['TRACK-010'][7][5],0);assert.equal(e.data.MEMBERS[1][18],25);
 const writes=e.writes();assert(e.c._mwPrApply_(apply,'test').alreadyRecorded);assert.equal(e.writes(),writes);
 assert.throws(()=>e.c._mwPrPreview_({...p,sourceRow:12,requestId:'dismiss-confirmed-12345'},'test'),/Only an unresolved/);
}
{
 const e=ops();for(const n of ['012','013','014','015']){const f=e.data.FUNDS[3].slice();f[0]='FUND-'+n;f[9]=new Date('2020-01-01T12:00:00Z');e.data.FUNDS.push(f);e.data['TRACK-'+n]=e.data['TRACK-011'].map(r=>r.slice());}
 const heads=['Decision','Member ID','Member Name','Email','Missed Count','Outstanding Funds','System Total','Deadline','Investigation Notes','Last Evaluated','Send Status','Sent At'];e.data['REMOVAL REVIEW']=[heads,['EXCLUDE','MW0083','','',0,'',0,'','','','','']];
 const list=e.c._mwOpsNoticeList_();assert.equal(list.members.length,2);assert(list.members.every(m=>m.missed>=5));assert(!list.members.find(m=>m.memberId==='MW0083').canSend);assert.equal(e.writes(),0);
 e.c._buildTerminationNoticeEmail=(cfg,m,deadline)=>({subject:'Warning '+m.id,text:'Deadline '+deadline+' total '+m.total,html:'<p>Warning</p>'});
 let sent=0;e.c.sendEmail=()=>{sent++;return true;};const request={memberIds:['MW0100'],deadline:'2030-01-08'};
 const pre=e.c._mwOpsNoticePreview_(request);assert.equal(e.writes(),0);assert.equal(sent,0);assert.equal(pre.messages.length,1);
 assert.throws(()=>e.c._mwOpsNoticePreview_({...request,memberIds:['MW0083']}),/EXCLUDE/);
 const result=e.c._mwOpsNoticeSend_({...request,confirmed:'YES',previewToken:pre.previewToken});assert.equal(result.results[0].status,'SENT');assert.equal(sent,1);
 assert.equal(e.data['REMOVAL REVIEW'][1][0],'EXCLUDE');const saved=e.data['REMOVAL REVIEW'].find(r=>r[1]==='MW0100');assert.equal(saved[10],'SENT');assert.equal(e.data.MEMBERS[2][16],'MW0100');
 assert.throws(()=>e.c._mwOpsNoticeSend_({...request,confirmed:'YES',previewToken:pre.previewToken}),/already sent/);assert.equal(sent,1);
}
{
 const e=ops();e.c.Session={getScriptTimeZone:()=> 'America/Chicago'};let state={};e.c._loadZelleDayState_=()=>({...state});e.c._saveZelleDayState_=(_,s)=>{state=s;};
 const msg={getId:()=> 'email123',getFrom:()=> 'Chase <no.reply.alerts@chase.com>',getSubject:()=> 'You received money with Zelle',getPlainBody:()=> 'NEW SENDER sent you money\nAmount: $15\nTransaction number: 999999999',getDate:()=>new Date('2026-11-20T18:00:00Z')};
 e.c.parseZelleAmount=()=>15;e.c.extractMemberIdsAndNames=()=>({rawMemo:'MW0083 FUND-011',memberIds:['MW0083']});e.c.GmailApp={getMessageById:()=>msg};
 const p={messageId:'email123',requestId:'stage-email-12345678'},pre=e.c._mwOpsStagePreview_(p);assert.equal(e.writes(),0);assert.equal(Object.keys(state).length,0);
 const result=e.c._mwOpsStageApply_({...p,previewToken:pre.previewToken,confirmed:'YES'});assert.equal(result.row,14);assert.equal(state.email123,'REVIEW');assert.equal(e.data.PAYMENTS[13][10],'UNMATCHED');assert.equal(e.data.PAYMENTS[13][3],15);assert.equal(e.data['TRACK-011'][7][5],0);
 const writes=e.writes();assert(e.c._mwOpsStageApply_({...p,previewToken:pre.previewToken,confirmed:'YES'}).alreadyRecorded);assert.equal(e.writes(),writes);
 state.email456='APPLIED';const source=e.c._mwOpsMailSource_(msg);source.messageId='email456';assert(!e.c._mwOpsMailCheck_(source,e.c._mwPrLedger_()).canStage);
 const bad={...msg,getFrom:()=> 'Other <evil@example.test>'};assert.throws(()=>e.c._mwOpsMailSource_(bad),/not a verified/);
}
{
 const payout=fs.readFileSync(__dirname+'/../MW_PayoutDashboard.js','utf8');const a=payout.indexOf('function fpCalculationRows'),b=payout.indexOf('function fpPayload',a),c={fpMoney:v=>'$'+Number(v).toFixed(2),fpEscape:String};vm.createContext(c);vm.runInContext(payout.slice(a,b),c);
 const rows=c.fpCalculationRows({fund:{baseAmount:10},fullCount:297,coreBase:2975,adminFee:148.75,familyShare:2826.25,familyPaid:1500,remaining:1326.25});assert.equal(rows[1][1],'$5.00');assert.equal(rows[6][1],'$1326.25');
}
{
 const e=ops(),input={mode:'ALLOCATE',sourceRow:13,requestId:'unequal-split-1234567',allocations:[{memberId:'MW0083',fundCode:'FUND-010',amount:'10'},{memberId:'MW0083',fundCode:'FUND-011',amount:'5'},{memberId:'MW0083',fundCode:'CREDIT',amount:'25'}]};
 const pre=e.c._mwPrPreview_(input,'test');assert.equal(e.writes(),0);e.c._mwPrApply_({...pre.input,previewToken:pre.previewToken,confirmed:'YES'},'test');assert.equal(e.data['TRACK-011'][7][5],5);assert.equal(e.data['TRACK-011'][7][4],10);assert.equal(e.data.FUNDS[3][7],5);assert.equal(e.data.MEMBERS[1][18],50);
 assert.equal(e.data.PAYMENTS.slice(13).reduce((sum,r)=>sum+r[3],0),40);
}
// Standalone print output must contain real closing tags, not escaped HTML.
{
 const source=fs.readFileSync(__dirname+'/../MW_PayoutDashboard.js','utf8');let html='';const c={fpSummary:{fund:{code:'FUND-008',deceased:'Test',baseAmount:10},fullCount:297,coreBase:2975,adminFee:148.75,familyShare:2826.25,familyPaid:1500,remaining:1326.25,payouts:[],warnings:[],roster:[]},fpMoney:v=>'$'+Number(v).toFixed(2),fpEscape:String,fpStatus:()=>{},window:{open:()=>({document:{write:v=>html=v,close(){}}})}};vm.createContext(c);vm.runInContext(source.slice(source.indexOf('function fpCalculationRows'),source.indexOf('function fpPayload')),c);vm.runInContext(source.slice(source.indexOf('function fpPrintReport'),source.indexOf('function fpPrettyDue')),c);c.fpPrintReport();assert(!html.includes('<\\/'));assert(html.includes('Family share calculation'));assert(html.includes('$1326.25'));
}
console.log('PASS: no-write dismissal and warning previews; targeted dismissal without credit/fund changes; protected confirmed rows; five-plus threshold; exclusions and sent warnings preserved; selected-only email; no member removals; bank identity validation; staging with scanner reservation; no fund application during staging; repeat-safe import; source-state hold; calculation example.');
