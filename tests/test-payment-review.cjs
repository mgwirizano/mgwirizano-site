const fs=require('fs'),vm=require('vm'),assert=require('assert'),crypto=require('crypto');
function setup(){
 let writes=0,fail=false;const props={PAYOUT_ADMIN_EMAILS:'officer@example.test'},headers=['Payment Date & Time','Member ID','Full Name','Amount ($)','Payment Type','Fund','Prev Balance','New Balance','Zelle Sender Name','Raw Memo (exact as written)','Status','Processed At','Email Sent','Notes','Phone Number'];
 const f=(code,date)=>[code,code,'Test family',new Date('2026-01-01'),10,2,'',0,code==='FUND-010'?'ACTIVE':'CLOSED',new Date(date),'',''];
 const member=id=>{const r=Array(23).fill('');r[0]=new Date('2026-03-30');r[1]='member@example.test';r[2]='Test '+id;r[16]=id;r[18]=25;return r;};
 const tr=(id,paid=0)=>[id,'Test '+id,10,0,paid?0:10,paid,paid?new Date('2026-11-04'):'',paid?'PAID':'PENDING',''];
 const pay=(id,amount,type,fund,status='CONFIRMED')=>[new Date('2026-11-04'),id,'Test '+id,amount,type,fund,0,0,'TEST SENDER','MEMO',status,new Date('2026-11-04'),'YES','',''];
 const data={FUNDS:[['Fund'],f('FUND-009','2026-11-09T18:00:00Z'),f('FUND-010','2030-01-01T18:00:00Z'),f('FUND-011','2026-11-17T18:00:00Z')],MEMBERS:[[],member('MW0083'),member('MW0100')],EXEMPTIONS:[['Fund Code','Member ID']],PAYMENTS:Array.from({length:9},()=>Array(15).fill('')).concat([headers,pay('MW0083',25,'Registration Fee','REG'),pay('MW0083',10,'Funeral Contribution','FUND-009 — Ann Soko'),pay('UNMATCHED',40,'Unknown','UNMATCHED','UNMATCHED')])};
 for(const code of ['009','010','011']){data['TRACK-'+code]=Array.from({length:7},()=>Array(9).fill('')).concat([tr('MW0083',code==='009'?10:0),tr('MW0100')]);data['FUND-'+code]=Array.from({length:7},()=>Array(7).fill('')).concat([['Date','Member ID','Full Name','Amount Paid','Balance','Credit to Next Fund','Notes']]);}
 const tabs={};function tab(name){return tabs[name]??={getName:()=>name,getLastRow:()=>data[name].length,getDataRange:()=>({getValues:()=>data[name].map(r=>r.slice())}),getRange:(r,c,n=1,k=1)=>{const range={getValues:()=>Array.from({length:n},(_,i)=>Array.from({length:k},(_,j)=>data[name][r-1+i]?.[c-1+j]??'')),getFormulas:()=>Array.from({length:n},()=>Array(k).fill('')),getFormula:()=>'',setValues:values=>{writes++;values.forEach((row,i)=>{data[name][r-1+i]??=[];row.forEach((v,j)=>data[name][r-1+i][c-1+j]=v);});if(fail&&name.startsWith('TRACK-')){fail=false;throw Error('SIMULATED INTERRUPTION');}return range;},setBackground:()=>range,setFontColor:()=>range};return range;}};}
 const ss={getSheetByName:name=>data[name]?tab(name):null,getSpreadsheetTimeZone:()=> 'America/Chicago',insertSheet:name=>{writes++;data[name]=[];return tab(name);}};
 const c={Date,console,Logger:{log:()=>{}},getSpreadsheet:()=>ss,PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k]??null,setProperty:(k,v)=>{props[k]=v;},deleteProperty:k=>delete props[k]})},SpreadsheetApp:{flush:()=>{}},LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock:()=>{}})},Utilities:{DigestAlgorithm:{SHA_256:'sha256'},computeDigest:(_,s)=>crypto.createHash('sha256').update(s).digest(),base64EncodeWebSafe:b=>Buffer.from(b).toString('base64url'),formatDate:(d,tz)=>new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit'}).format(d)}};
 vm.createContext(c);for(const name of ['MW_Dashboard_Payouts.gs','MW_Dashboard_PaymentReview.gs'])vm.runInContext(fs.readFileSync((fs.existsSync(__dirname+'/MW_Dashboard_Payouts.gs')?__dirname:__dirname+'/..')+'/'+name,'utf8'),c);
 const input={mode:'ALLOCATE',sourceRow:13,requestId:'test-allocation-12345',allocations:[{memberId:'MW0083',fundCode:'FUND-010',amount:'10'},{memberId:'MW0100',fundCode:'FUND-010',amount:'10'},{memberId:'MW0083',fundCode:'CREDIT',amount:'20'}]};
 return {c,data,props,input,writes:()=>writes,fail:()=>fail=true};
}
{
 const e=setup(),profile=e.c._mwPrProfile_('MW0083');assert.equal(profile.availableCredit,25);assert.equal(profile.obligations[0].status,'PAID');assert.equal(profile.obligations[1].status,'PENDING');assert.equal(profile.obligations[1].balance,10);assert.equal(profile.obligations[2].balance,15);assert(profile.obligations[2].lateFeePending);assert.equal(profile.payments.length,1);assert.equal(profile.payments[0].fund,'FUND-009');assert.equal(e.writes(),0);
 const d=e.c._mwPrFeed_({});assert.equal(d.total,2);assert.equal(d.stats.confirmedCash,10);assert(d.payments.find(p=>p.row===13).canAllocate);
 const preview=e.c._mwPrPreview_(e.input,'officer');assert.equal(e.writes(),0);const result=e.c._mwPrApply_({...preview.input,previewToken:preview.previewToken,confirmed:'YES'},'officer');assert.equal(result.status,'ok');assert.equal(e.data.MEMBERS[1][18],45);assert.equal(e.data['TRACK-010'][7][4],0);assert.equal(e.data['TRACK-010'][8][5],10);assert.equal(e.data.FUNDS[2][7],20);assert.equal(e.data.PAYMENTS[12][10],'SPLIT-PROCESSED');assert.equal(e.data.PAYMENTS.length,16);assert.equal(e.data['FUND-010'].length,10);
 const writes=e.writes();assert(e.c._mwPrApply_({...preview.input,previewToken:preview.previewToken,confirmed:'YES'},'officer').alreadyRecorded);assert.equal(e.writes(),writes);assert.equal(e.c._mwPrFeed_({}).stats.confirmedCash,50);
}
{
 const e=setup(),input={mode:'CREDIT',requestId:'credit-request-1234567',allocations:[{memberId:'MW0083',fundCode:'FUND-011',amount:'15'}]};
 const pre=e.c._mwPrPreview_(input,'officer');assert.equal(e.writes(),0);e.c._mwPrApply_({...pre.input,previewToken:pre.previewToken,confirmed:'YES'},'officer');assert.equal(e.data.MEMBERS[1][18],10);assert.equal(e.data['TRACK-011'][7][3],15);assert.equal(e.data['TRACK-011'][7][4],0);assert.equal(e.data['TRACK-011'][7][5],0);assert.equal(e.data.PAYMENTS.length,13);assert.equal(e.data.FUNDS[3][7],0);assert.equal(e.c._mwPrProfile_('MW0083').obligations[2].status,'COVERED BY CREDIT');
}
{
 const e=setup(),pre=e.c._mwPrPreview_(e.input,'officer');e.fail();assert.throws(()=>e.c._mwPrApply_({...pre.input,previewToken:pre.previewToken,confirmed:'YES'},'officer'),/SIMULATED/);assert(e.props.MWPR_PENDING);assert.equal(e.data['TRACK-010'][7][4],0);
 e.c._mwPrApply_({...pre.input,previewToken:pre.previewToken,confirmed:'YES'},'officer');assert.equal(e.data.MEMBERS[1][18],45);assert.equal(e.data.PAYMENTS.length,16);assert.equal(e.data.FUNDS[2][7],20);assert(!e.props.MWPR_PENDING);
}
{
 const e=setup(),pre=e.c._mwPrPreview_(e.input,'officer');e.data['TRACK-010'][7][4]=5;assert.throws(()=>e.c._mwPrApply_({...pre.input,previewToken:pre.previewToken,confirmed:'YES'},'officer'));assert.equal(e.writes(),0);
}
{
 const e=setup();assert.throws(()=>e.c._mwPrPreview_({...e.input,sourceRow:12},'officer'),/not an unallocated/);assert.throws(()=>e.c._mwPrPreview_({...e.input,allocations:e.input.allocations.slice(0,1)},'officer'),/exactly equal/);
 e.data['TRACK-010'][7][7]='PAID';e.data['TRACK-010'][7][4]=0;let p=e.c._mwPrProfile_('MW0083');assert.equal(p.obligations[1].status,'REVIEW');assert.equal(p.obligations[1].balance,10);
 e.data['TRACK-010'][7][7]='EXEMPT';e.data['TRACK-010'][7][3]='N/A';e.data['TRACK-010'][7][4]='N/A';assert.equal(e.c._mwPrProfile_('MW0083').obligations[1].status,'EXEMPT');
}
{
 const e=setup();
 for(const id of ['MW0001','MW0005','MW0007','MW0324','MW0369','MW0031'])assert(e.c._mwPrExempt_(id,'FUND-011',e.data['TRACK-011'][7],e.data.FUNDS[3]),id+' must be exempt');
 assert(!e.c._mwPrExempt_('MW0083','FUND-011',e.data['TRACK-011'][7],e.data.FUNDS[3]));
 assert.equal(e.writes(),0);
}
console.log('PASS: real row-10 headers and Fund column F; no registration rows; exact fund history; no reusable aggregate credit; overdue $15; source conservation; no duplicate allocation; existing credit moved once without new cash; targeted fund log/totals; zero-write preview; changed-data hold; interrupted-write resume; no automatic tracker reconciliation.');
