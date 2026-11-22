// Add-on for the payout dispatch. Preview first; no automatic fixes or emails.
// Exact PAYMENTS headers, member IDs, and fund codes. No aggregate-money coverage.
var MWPR_READ_CACHE = {}, MWPR_SS = null;
function _mwPrSS_(){return MWPR_SS || (MWPR_SS=_mwFpSS_());}
function _mwPrValues_(sheet){var name=sheet.getName();if(!MWPR_READ_CACHE[name])MWPR_READ_CACHE[name]=sheet.getDataRange().getValues();return MWPR_READ_CACHE[name];}
function _mwPrRoute_(p,actor){
  MWPR_READ_CACHE={}; MWPR_SS=null;
  if(p.action==='fp_review_feed')return _mwPrFeed_(p);
  if(p.action==='fp_review_profile')return _mwPrProfile_(p.memberId);
  if(p.action==='fp_review_fund')return _mwPrFundView_(p.fundCode);
  if(p.action==='fp_review_preview')return _mwPrPreview_(p,actor);
  if(p.action==='fp_review_apply')return _mwPrApply_(p,actor);
  if(p.action==='fp_review_resume')return _mwPrResume_(p,actor);
  throw Error('Unknown payment review action');
}
function _mwPrText_(v){return String(v==null?'':v).trim();}
function _mwPrCode_(v){var matches=_mwPrText_(v).toUpperCase().match(/\bFUND-\d{3}\b/g)||[];return matches.length===1?matches[0]:'';}
function _mwPrId_(v){var id=_mwPrText_(v).toUpperCase();return /^MW\d{4,6}$/.test(id)?id:'';}
function _mwPrDate_(v){return v instanceof Date&&!isNaN(v.getTime())?Utilities.formatDate(v,_mwPrSS_().getSpreadsheetTimeZone(),'yyyy-MM-dd HH:mm:ss'):'';}
function _mwPrNormalize_(v){return _mwPrText_(v).toLowerCase().replace(/[^a-z0-9]/g,'');}
function _mwPrLedger_(){
  var sh=_mwPrSS_().getSheetByName('PAYMENTS');if(!sh)throw Error('PAYMENTS missing');
  var data=sh.getDataRange().getValues(),header=-1,map={};
  var labels={date:['paymentdatetime','paymentdate'],id:['memberid'],name:['fullname'],amount:['amount','amountdollars'],type:['paymenttype'],fund:['fund','fundcode'],prev:['prevbalance','previousbalance'],balance:['newbalance'],sender:['zellesendername'],memo:['rawmemoexactaswritten','rawmemo'],status:['status'],processed:['processedat'],email:['emailsent'],notes:['notes']};
  data.slice(0,30).forEach(function(row,i){var normalized=row.map(_mwPrNormalize_);if(normalized.indexOf('memberid')<0||normalized.indexOf('paymenttype')<0||normalized.indexOf('status')<0)return;if(header>=0)throw Error('Ambiguous PAYMENTS headers');header=i;Object.keys(labels).forEach(function(k){map[k]=normalized.findIndex(function(h){return labels[k].indexOf(h)>=0;});if(map[k]<0)throw Error('PAYMENTS header missing: '+k);});});
  if(header<0)throw Error('Cannot identify PAYMENTS headers; no column guessing permitted.');
  var rows=[];
  data.slice(header+1).forEach(function(r,i){
    if(!r.some(function(v){return v!==''&&v!==null;}))return;
    if(typeof r[map.amount]!=='number'||!isFinite(r[map.amount]))return;
    var type=_mwPrText_(r[map.type]),status=_mwPrText_(r[map.status]).toUpperCase(),id=_mwPrId_(r[map.id]),fund=_mwPrCode_(r[map.fund]);
    var credit=/^funeral credit$/i.test(type),confirmed=['CONFIRMED','DETECTED','NAME-MATCHED','MANUAL ENTRY','VERIFIED','APPROVED','SETTLED'].indexOf(status)>=0;
    var allocated=confirmed&&!!id&&((/^funeral contribution$/i.test(type)&&!!fund)||credit)&&! /GUARD|REVERSAL GUARD/i.test(_mwPrText_(r[map.id])+' '+_mwPrText_(r[map.notes])+' '+_mwPrText_(r[map.memo]));
    var reasons=[];
    if(!/^registration fee$/i.test(type)&&r[map.amount]>0&&['REVERSED','DISMISSED','REASSIGNED','SPLIT','SPLIT-PROCESSED','SETTLED'].indexOf(status)<0){
      if(!id)reasons.push('Member not assigned');
      if(!fund&&!credit)reasons.push('Fund not assigned');
      if(!r[map.memo]||/^(n\/?a|none|\(no memo\))$/i.test(_mwPrText_(r[map.memo])))reasons.push('No payment memo');
      if(!allocated)reasons.push('Unverified / unallocated payment');
    }
    rows.push({row:header+2+i,memberId:id,rawMemberId:_mwPrText_(r[map.id]),name:_mwPrText_(r[map.name]),amount:r[map.amount],type:type,fund:fund,date:_mwPrDate_(r[map.date]),
      timestamp:r[map.date] instanceof Date?r[map.date].getTime():0,sender:_mwPrText_(r[map.sender]),memo:_mwPrText_(r[map.memo]),status:status,notes:_mwPrText_(r[map.notes]),
      allocated:allocated,needsReview:reasons.length>0,reasons:reasons,canAllocate:['UNMATCHED','REVIEW','NEEDS REVIEW','AMBIGUOUS','PENDING'].indexOf(status)>=0&&r[map.amount]>0&&!/GUARD/i.test(_mwPrText_(r[map.id])+' '+_mwPrText_(r[map.notes])+' '+_mwPrText_(r[map.memo])),raw:r});
  });
  return {sheet:sh,data:data,header:header,map:map,rows:rows};
}
function _mwPrPublicPayment_(r){var out={};Object.keys(r).forEach(function(k){if(k!=='raw')out[k]=r[k];});return out;}
function _mwPrFeed_(p){
  var ledger=_mwPrLedger_(),all=ledger.rows.filter(function(r){return !/^registration fee$/i.test(r.type);});
  var query=_mwPrText_(p.query).toLowerCase(),fund=_mwPrText_(p.fundCode);
  var filtered=all.filter(function(r){return (p.reviewOnly!=='YES'||r.needsReview)&&(!p.statusFilter||r.status===p.statusFilter)&&(!fund||r.fund===fund)&&(!query||[r.memberId,r.name,r.sender,r.memo,r.status].join(' ').toLowerCase().indexOf(query)>=0);});
  filtered.sort(function(a,b){return b.timestamp-a.timestamp||b.row-a.row;});
  var offset=Math.max(0,parseInt(p.offset,10)||0),limit=50;
  return {status:'ok',payments:filtered.slice(offset,offset+limit).map(_mwPrPublicPayment_),total:filtered.length,offset:offset,limit:limit,
    stats:{rows:all.length,review:all.filter(function(r){return r.needsReview;}).length,confirmedCash:all.filter(function(r){return r.allocated;}).reduce(function(a,r){return a+Math.round(r.amount*100);},0)/100},
    pendingAction:PropertiesService.getScriptProperties().getProperty('MWPR_PENDING')||''};
}
function _mwPrMember_(id){
  id=_mwPrId_(id);if(!id)throw Error('Enter an exact member ID.');
  var sh=_mwPrSS_().getSheetByName('MEMBERS');if(!sh)throw Error('MEMBERS missing');var data=_mwPrValues_(sh),found=[];
  data.forEach(function(r,i){if(_mwPrId_(r[16])===id)found.push({row:i+1,raw:r});});
  if(found.length!==1)throw Error('Member missing or duplicated: '+id);
  return {id:id,row:found[0].row,raw:found[0].raw,sheet:sh};
}
function _mwPrExempt_(id,code,track,fundRow){
  if((MW_FP.leaderIds||[]).indexOf(id)>=0||_mwPrId_(fundRow[11])===id||(_mwPrText_(fundRow[6]).toUpperCase().match(/MW\d{4,6}/g)||[]).indexOf(id)>=0||/^EXEMPT\b/i.test(_mwPrText_(track[7])))return true;
  var sh=_mwPrSS_().getSheetByName('EXEMPTIONS');if(!sh)throw Error('EXEMPTIONS missing; review before changing an obligation.');
  var d=_mwPrValues_(sh),h=-1,mi=-1,fi=-1;
  d.slice(0,20).forEach(function(r,i){var a=r.map(_mwPrNormalize_);if(a.indexOf('memberid')>=0&&(a.indexOf('fundcode')>=0||a.indexOf('fund')>=0)){h=i;mi=a.indexOf('memberid');fi=a.indexOf('fundcode')>=0?a.indexOf('fundcode'):a.indexOf('fund');}});
  if(h<0)throw Error('EXEMPTIONS headers cannot be identified.');
  return d.slice(h+1).some(function(r){var f=_mwPrText_(r[fi]).toUpperCase();return _mwPrId_(r[mi])===id&&(f===code||f==='ALL');});
}
function _mwPrObligation_(id,code,ledger){
  var ss=_mwPrSS_(),fd=_mwPrValues_(ss.getSheetByName('FUNDS')),matches=[];
  fd.forEach(function(r,i){if(_mwPrText_(r[0]).toUpperCase()===code)matches.push({raw:r,row:i+1});});if(matches.length!==1)throw Error('Fund missing or duplicated');
  var f=matches[0],sh=ss.getSheetByName('TRACK-'+code.slice(-3));if(!sh)return {fundCode:code,status:'REVIEW',balance:null,issues:['TRACK sheet missing']};
  var d=_mwPrValues_(sh),found=[];
  d.slice(7).forEach(function(r,i){if(_mwPrId_(r[0])===id)found.push({raw:r,row:i+8});});
  if(found.length!==1)return {fundCode:code,status:'REVIEW',balance:null,issues:[found.length?'Duplicate tracker rows':'No obligation row; do not assume this member owes this fund']};
  var t=found[0],tr=t.raw,exempt=_mwPrExempt_(id,code,t.raw,f.raw),paidRows=ledger.rows.filter(function(r){return r.memberId===id&&r.fund===code&&r.allocated&&/^funeral contribution$/i.test(r.type);});
  var paid=paidRows.reduce(function(a,r){return a+Math.round(r.amount*100);},0),applied=exempt?0:_mwFpMoney_(tr[3]),recorded=exempt?0:_mwFpMoney_(tr[4]),trackPaid=_mwFpMoney_(tr[5]),base=_mwFpMoney_(f.raw[4]),notes=_mwPrText_(tr[8]),issues=[];
  var settled=/^(PAID|COVERED BY CREDIT)\b/i.test(_mwPrText_(tr[7]))&&recorded===0;
  var deadline=f.raw[9] instanceof Date?Utilities.formatDate(f.raw[9],ss.getSpreadsheetTimeZone(),'yyyy-MM-dd'):'';
  var expired=deadline&&deadline<Utilities.formatDate(new Date(),'America/Los_Angeles','yyyy-MM-dd');
  var waived=/LATE_FEE_REVERSED|late fee (?:reversed|waived)|waive[d]? late fee/i.test(notes);
  var assessed=!waived&&(/late fee/i.test(notes)||/^LATE\b/i.test(_mwPrText_(tr[7]))||recorded+trackPaid+applied>base);
  var fee=!exempt&&!waived&&(assessed||(!settled&&expired))?500:0;
  var expected=Math.max(0,base+fee-paid-applied),balance=exempt?0:Math.max(recorded,expected),pendingFee=!assessed&&fee>0;
  if(paid!==trackPaid)issues.push('PAYMENTS total '+(paid/100)+' differs from TRACK paid '+(trackPaid/100));
  if(settled&&paid+applied<base)issues.push('TRACK says paid without enough fund-specific payment or applied credit');
  if(pendingFee)issues.push('$5 late fee is due by deadline policy but has not yet been assessed in TRACK');
  if(recorded<0||applied<0||trackPaid<0)issues.push('Negative tracker value requires review');
  if(!exempt&&recorded!==expected&&!pendingFee)issues.push('TRACK balance differs from fund-specific allocation');
  var status=exempt?'EXEMPT':issues.some(function(x){return !/^\$5 late fee/.test(x);})?'REVIEW':balance===0?(applied>0&&paid===0?'COVERED BY CREDIT':'PAID'):(paid+applied>0?'PARTIAL':'PENDING');
  return {fundCode:code,deceased:_mwPrText_(f.raw[2]),fundStatus:_mwPrText_(f.raw[8]),base:base/100,lateFee:fee/100,lateFeePending:pendingFee,
    balance:balance/100,recordedBalance:recorded/100,paid:paid/100,creditApplied:applied/100,status:status,trackerStatus:_mwPrText_(tr[7]),
    paymentDates:paidRows.map(function(r){return r.date;}).filter(Boolean).sort().reverse(),deadline:deadline,issues:issues,
    _track:{sheet:sh.getName(),row:t.row,raw:tr},_fund:{row:f.row,raw:f.raw}};
}
function _mwPrPublicObligation_(o){var r={};Object.keys(o).forEach(function(k){if(k.charAt(0)!=='_')r[k]=o[k];});return r;}
function _mwPrProfile_(id){
  MWPR_READ_CACHE={};
  var m=_mwPrMember_(id),ledger=_mwPrLedger_(),funds=_mwFpFunds_(),obligations=funds.map(function(f){return _mwPrPublicObligation_(_mwPrObligation_(m.id,f.code,ledger));});
  var payments=ledger.rows.filter(function(r){return r.memberId===m.id&&!/^registration fee$/i.test(r.type);}).sort(function(a,b){return b.timestamp-a.timestamp||b.row-a.row;});
  return {status:'ok',memberId:m.id,name:_mwPrText_(m.raw[2]),email:_mwPrText_(m.raw[1]),phone:_mwPrText_(m.raw[3]),location:_mwPrText_(m.raw[4]),
    joined:_mwPrDate_(m.raw[0]),availableCredit:_mwFpMoney_(m.raw[18])/100,obligations:obligations,payments:payments.map(_mwPrPublicPayment_),
    issues:obligations.filter(function(o){return o.issues.length;}).map(function(o){return o.fundCode+': '+o.issues.join('; ');}),
    family:{father:_mwPrText_(m.raw[7]),mother:_mwPrText_(m.raw[8]),spouse:_mwPrText_(m.raw[9]),children:_mwPrText_(m.raw[10]),siblings:_mwPrText_(m.raw[11])}};
}
function _mwPrFundView_(code){
  MWPR_READ_CACHE={};
  var fund=_mwFpFund_(code),ledger=_mwPrLedger_(),sh=_mwPrSS_().getSheetByName('TRACK-'+code.slice(-3));if(!sh)throw Error('TRACK missing');
  var ids=sh.getDataRange().getValues().slice(7).map(function(r){return _mwPrId_(r[0]);}).filter(Boolean);
  var rows=ids.map(function(id){var o=_mwPrPublicObligation_(_mwPrObligation_(id,code,ledger));var m=_mwPrMember_(id);o.memberId=id;o.name=_mwPrText_(m.raw[2]);return o;});
  return {status:'ok',fund:fund,members:rows};
}

// Journaled writes: one approved request at a time; old/new values verified.
// A retry resumes the same request without appending duplicate ledger rows.
function _mwPrPack_(v){if(v instanceof Date)return {mwDate:v.toISOString()};if(Array.isArray(v))return v.map(_mwPrPack_);return v===undefined?'':v;}
function _mwPrUnpack_(v){if(v&&v.mwDate)return new Date(v.mwDate);if(Array.isArray(v))return v.map(_mwPrUnpack_);return v;}
function _mwPrOp_(sheet,row,col,after){var range=sheet.getRange(row,col,after.length,after[0].length);if(range.getFormulas().some(function(r){return r.some(Boolean);}))throw Error('Formula target requires review: '+sheet.getName()+' '+row);return {sheet:sheet.getName(),row:row,col:col,before:_mwPrPack_(range.getValues()),after:_mwPrPack_(after)};}
function _mwPrInput_(p){
  var id=_mwPrText_(p.requestId);if(!/^[A-Za-z0-9-]{16,80}$/.test(id))throw Error('Request ID missing');
  var mode=p.mode;if(['ALLOCATE','CREDIT','DISMISS'].indexOf(mode)<0)throw Error('Invalid action');
  var reason=_mwPrText_(p.reason);if(mode==='DISMISS'&&(reason.length<5||reason.length>500))throw Error('Enter a dismissal reason (5–500 characters)');
  var allocations=mode==='DISMISS'?[]:p.allocations;if(mode!=='DISMISS'&&(!Array.isArray(allocations)||!allocations.length||allocations.length>10))throw Error('Enter 1–10 explicit allocations');
  allocations=allocations.map(function(a){var amount=String(a.amount||'');if(!/^\d+(\.\d{1,2})?$/.test(amount)||Number(amount)<=0)throw Error('Invalid allocation amount');var memberId=_mwPrId_(a.memberId),code=_mwPrText_(a.fundCode).toUpperCase();if(!memberId||!(/^FUND-\d{3}$/.test(code)||code==='CREDIT'))throw Error('Each allocation needs an exact member and fund (or CREDIT)');return {memberId:memberId,fundCode:code,amount:Number(amount)};});
  if(mode==='CREDIT'&&(allocations.length!==1||allocations[0].fundCode==='CREDIT'))throw Error('Apply existing credit to one chosen fund at a time');
  var preparedAt=p.preparedAt||new Date().toISOString();if(isNaN(new Date(preparedAt).getTime()))throw Error('Invalid preview time');
  return {requestId:id,mode:mode,sourceRow:Number(p.sourceRow)||0,allocations:allocations,reason:reason,preparedAt:preparedAt};
}
function _mwPrPlan_(input,actor){
  MWPR_READ_CACHE={};
  var ss=_mwPrSS_(),ledger=_mwPrLedger_(),source=null,ops=[],explain=[],memberCredit={},seen={},fundTotals={},nextRows={},date=new Date(input.preparedAt),map=ledger.map;
  function append(sheet,values){var name=sheet.getName(),row=nextRows[name]||(sheet.getLastRow()+1);nextRows[name]=row+1;ops.push(_mwPrOp_(sheet,row,1,[values]));}
  if(input.mode==='DISMISS'){
    source=ledger.rows.filter(function(r){return r.row===input.sourceRow;})[0];
    if(!source||!source.canAllocate||source.allocated||/GUARD|SETTLED|REVERSED/i.test(source.rawMemberId+' '+source.status+' '+source.notes))throw Error('Only an unresolved, unallocated payment may be dismissed. Settled guards and confirmed payments are protected.');
    ops.push(_mwPrOp_(ledger.sheet,source.row,map.id+1,[['DISMISSED']]));
    ops.push(_mwPrOp_(ledger.sheet,source.row,map.status+1,[['DISMISSED']]));
    ops.push(_mwPrOp_(ledger.sheet,source.row,map.notes+1,[[_mwFpSafeText_(source.notes+' | [MWPR '+input.requestId+'] Dismissed '+input.preparedAt+'; original member: '+source.rawMemberId+'; reason: '+input.reason)]]));
    return {requestId:input.requestId,input:input,actor:actor,operations:ops,allocations:[],sourceAmount:source.amount,created:new Date().toISOString()};
  }
  if(input.mode==='ALLOCATE'){
    source=ledger.rows.filter(function(r){return r.row===input.sourceRow;})[0];if(!source||!source.canAllocate||source.allocated)throw Error('Source is not an unallocated review payment. Confirmed or settled rows cannot be allocated again.');
    if(!(source.raw[map.date] instanceof Date)||!source.date)throw Error('Source payment date must be verified first');
    var sum=input.allocations.reduce(function(a,r){return a+Math.round(r.amount*100);},0);if(sum!==Math.round(source.amount*100))throw Error('Allocations must exactly equal the source amount; choose CREDIT explicitly for any excess');
    date=source.raw[map.date];
  }
  input.allocations.forEach(function(a){
    var member=_mwPrMember_(a.memberId),key=a.memberId+'|'+a.fundCode,cents=Math.round(a.amount*100);
    if(seen[key])throw Error('Duplicate allocation target');seen[key]=true;
    if(a.fundCode==='CREDIT'){
      if(!memberCredit[a.memberId])memberCredit[a.memberId]={member:member,before:_mwFpMoney_(member.raw[18]),delta:0};
      memberCredit[a.memberId].delta+=cents;explain.push({memberId:a.memberId,fundCode:'CREDIT',amount:a.amount,creditAdded:a.amount});
    }else{
      var o=_mwPrObligation_(a.memberId,a.fundCode,ledger);
      if(o.status==='EXEMPT'||o.status==='REVIEW'||o.balance===null)throw Error(a.memberId+' '+a.fundCode+': '+(o.issues.join('; ')||o.status)+' — review first');
      if(cents>Math.round(o.balance*100))throw Error('Allocation exceeds this fund\'s remaining balance; do not overpay or redirect automatically.');
      var tr=o._track.raw,after=tr.slice(3,9),newBalance=Math.round(o.balance*100)-cents;
      if(input.mode==='CREDIT'){
        var available=_mwFpMoney_(member.raw[18]);if(cents>available)throw Error('Insufficient available funeral credit');
        memberCredit[a.memberId]={member:member,before:available,delta:-cents};after[0]=(_mwFpMoney_(tr[3])+cents)/100;
      }else{after[2]=(_mwFpMoney_(tr[5])+cents)/100;after[3]=date;}
      after[1]=newBalance/100;after[4]=newBalance===0?(input.mode==='CREDIT'&&_mwFpMoney_(tr[5])===0?'COVERED BY CREDIT':'PAID'):'PARTIAL — $'+(newBalance/100).toFixed(2)+' remaining';
      after[5]=_mwPrText_(tr[8])+' | '+(o.lateFeePending?'Late fee of $5 assessed with this approved allocation | ':'')+'[MWPR '+input.requestId+' '+input.mode+'] '+actor+' '+input.preparedAt;
      ops.push(_mwPrOp_(ss.getSheetByName(o._track.sheet),o._track.row,4,[after]));
      explain.push({memberId:a.memberId,fundCode:a.fundCode,amount:a.amount,previousBalance:o.balance,newBalance:newBalance/100,lateFeeAssessed:o.lateFeePending?5:0,creditApplied:input.mode==='CREDIT'?a.amount:0});
      if(input.mode==='ALLOCATE'){
        var log=ss.getSheetByName(a.fundCode);if(!log)throw Error('Fund payment log missing: '+a.fundCode);
        var headers=log.getRange(8,1,1,7).getValues()[0].map(_mwPrNormalize_);
        if(!/^date/.test(headers[0])||headers[1]!=='memberid'||headers[3]!=='amountpaid')throw Error('Unrecognized fund log headers: '+a.fundCode);
        nextRows[a.fundCode]=nextRows[a.fundCode]||Math.max(9,log.getLastRow()+1);
        append(log,[date,a.memberId,_mwFpSafeText_(_mwPrText_(member.raw[2])),a.amount,newBalance/100,'','[MWPR '+input.requestId+'] PAYMENTS source row '+source.row]);
        fundTotals[a.fundCode]=fundTotals[a.fundCode]||{row:o._fund.row,before:_mwFpMoney_(o._fund.raw[7]),add:0};fundTotals[a.fundCode].add+=cents;
      }
    }
    if(input.mode==='ALLOCATE'){
      var values=Array(ledger.data[ledger.header].length).fill('');
      values[map.date]=date;values[map.id]=a.memberId;values[map.name]=_mwFpSafeText_(_mwPrText_(member.raw[2]));values[map.amount]=a.amount;
      values[map.type]=a.fundCode==='CREDIT'?'Funeral Credit':'Funeral Contribution';values[map.fund]=a.fundCode;values[map.sender]=_mwFpSafeText_(source.sender);values[map.memo]=_mwFpSafeText_(source.memo);
      values[map.status]='CONFIRMED';values[map.processed]=new Date(input.preparedAt);values[map.email]='NOT SENT';values[map.notes]='[MWPR '+input.requestId+'] Source PAYMENTS row '+source.row+' | '+actor;
      var detail=explain[explain.length-1];values[map.prev]=a.fundCode==='CREDIT'?'':detail.previousBalance;values[map.balance]=a.fundCode==='CREDIT'?'':detail.newBalance;
      append(ledger.sheet,values);
    }
  });
  Object.keys(memberCredit).forEach(function(id){var v=memberCredit[id];ops.push(_mwPrOp_(v.member.sheet,v.member.row,19,[[(v.before+v.delta)/100]]));});
  Object.keys(fundTotals).forEach(function(code){var t=fundTotals[code],sheet=ss.getSheetByName('FUNDS');if(!sheet.getRange(t.row,8).getFormula())ops.push(_mwPrOp_(sheet,t.row,8,[[(t.before+t.add)/100]]));});
  if(source){
    ops.push(_mwPrOp_(ledger.sheet,source.row,map.status+1,[['SPLIT-PROCESSED']]));
    ops.push(_mwPrOp_(ledger.sheet,source.row,map.notes+1,[[_mwFpSafeText_(source.notes+' | [MWPR '+input.requestId+'] Allocated to child rows; exclude original from payment totals')]]));
  }
  return {requestId:input.requestId,input:input,actor:actor,operations:ops,allocations:explain,sourceAmount:source?source.amount:0,created:new Date().toISOString()};
}
function _mwPrReceipt_(id){var sh=_mwPrSS_().getSheetByName('MW_PAYMENT_ACTIONS');if(!sh)return null;var rows=sh.getDataRange().getValues().filter(function(r){return r[0]===id;});if(rows.length>1)throw Error('Duplicate action receipt');return rows.length?{inputHash:rows[0][4],row:rows[0]}:null;}
function _mwPrPreview_(p,actor){var input=_mwPrInput_(p),receipt=_mwPrReceipt_(input.requestId);if(receipt)return {status:'ok',alreadyRecorded:true,message:'Request already completed.'};var pending=PropertiesService.getScriptProperties().getProperty('MWPR_PENDING');if(pending)throw Error('An unfinished approved request needs resume first: '+pending);var plan=_mwPrPlan_(input,actor);return {status:'ok',dryRun:true,plan:{allocations:plan.allocations,sourceAmount:plan.sourceAmount,targets:plan.operations.map(function(o){return {sheet:o.sheet,row:o.row,column:o.col,before:o.before,after:o.after};})},previewToken:_mwFpHash_(plan.operations),input:input,requestId:input.requestId,message:'Preview only. No balances, rows or emails changed.'};}
function _mwPrStore_(plan){var props=PropertiesService.getScriptProperties(),text=JSON.stringify(plan),count=Math.ceil(text.length/5000);for(var i=0;i<count;i++)props.setProperty('MWPR_PART_'+i,text.slice(i*5000,(i+1)*5000));props.setProperty('MWPR_PART_COUNT',String(count));props.setProperty('MWPR_PENDING',plan.requestId);}
function _mwPrLoad_(){var props=PropertiesService.getScriptProperties(),id=props.getProperty('MWPR_PENDING');if(!id)return null;var count=Number(props.getProperty('MWPR_PART_COUNT')),text='';for(var i=0;i<count;i++){var part=props.getProperty('MWPR_PART_'+i);if(!part)throw Error('Action checkpoint incomplete. Manual review required.');text+=part;}var plan=JSON.parse(text);if(plan.requestId!==id)throw Error('Action checkpoint mismatch');return plan;}
function _mwPrEqual_(a,b){function norm(v){if(Array.isArray(v))return v.map(norm);if(v instanceof Date)return {mwDate:v.toISOString()};if(typeof v==='string'&&/^'[=+@-]/.test(v))return v.slice(1);return v;}return JSON.stringify(norm(a))===JSON.stringify(norm(b));}
function _mwPrExecute_(plan){
  var ss=_mwPrSS_(),start=Date.now();
  // Verify every pending target before resuming any write; changed rows are held.
  plan.operations.forEach(function(o){var range=ss.getSheetByName(o.sheet).getRange(o.row,o.col,o.after.length,o.after[0].length),actual=range.getValues();if(range.getFormulas().some(function(r){return r.some(Boolean);}))throw Error('Formula introduced into an approved target; manual review required');if(!_mwPrEqual_(actual,_mwPrUnpack_(o.before))&&!_mwPrEqual_(actual,_mwPrUnpack_(o.after)))throw Error('Target changed; review required: '+o.sheet+' row '+o.row);});
  plan.operations.forEach(function(o){
    if(Date.now()-start>180000)throw Error('Time limit approaching. Resume the same approved request.');
    var range=ss.getSheetByName(o.sheet).getRange(o.row,o.col,o.after.length,o.after[0].length),actual=range.getValues();
    if(_mwPrEqual_(actual,_mwPrUnpack_(o.after)))return;
    if(!_mwPrEqual_(actual,_mwPrUnpack_(o.before)))throw Error('Target changed; review required: '+o.sheet+' row '+o.row);
    range.setValues(_mwPrUnpack_(o.after));SpreadsheetApp.flush();if(!_mwPrEqual_(range.getValues(),_mwPrUnpack_(o.after)))throw Error('Write verification needs review: '+o.sheet+' row '+o.row);
  });
  var audit=ss.getSheetByName('MW_PAYMENT_ACTIONS');if(!audit){audit=ss.insertSheet('MW_PAYMENT_ACTIONS');audit.getRange(1,1,1,6).setValues([['Request ID','Completed At','Actor','Action','Input Hash','Allocations']]);}
  if(!_mwPrReceipt_(plan.requestId))audit.getRange(audit.getLastRow()+1,1,1,6).setValues([[plan.requestId,new Date(),plan.actor,plan.input.mode,_mwFpHash_(plan.input),JSON.stringify(plan.allocations)]]);
  if(!_mwPrReceipt_(plan.requestId))throw Error('Audit receipt could not be verified. Resume same request.');
  // Colors are display only; all amounts have already been verified.
  plan.operations.filter(function(o){return /^TRACK-/.test(o.sheet)&&o.col===4;}).forEach(function(o){var status=String(_mwPrUnpack_(o.after)[0][4]);try{ss.getSheetByName(o.sheet).getRange(o.row,8).setFontColor(/^(PAID|COVERED)/.test(status)?'#217B31':'#D68B0C').setBackground(/^(PAID|COVERED)/.test(status)?'#eaf5ed':'#fff8e1');}catch(_) {}});
  var props=PropertiesService.getScriptProperties(),count=Number(props.getProperty('MWPR_PART_COUNT'));props.deleteProperty('MWPR_PENDING');for(var i=0;i<count;i++)props.deleteProperty('MWPR_PART_'+i);props.deleteProperty('MWPR_PART_COUNT');
  return {status:'ok',requestId:plan.requestId,message:'Approved request completed and audited.',allocations:plan.allocations};
}
function _mwPrApply_(p,actor){
  if(p.confirmed!=='YES')throw Error('Preview and confirm first');var lock=LockService.getScriptLock();if(!lock.tryLock(15000))throw Error('Payment operation busy; retry same request');
  try{var input=_mwPrInput_(p),receipt=_mwPrReceipt_(input.requestId);if(receipt){if(receipt.inputHash!==_mwFpHash_(input))throw Error('Request ID belongs to different details');return {status:'ok',alreadyRecorded:true,message:'Already completed. No duplicate changes.'};}
    var pending=_mwPrLoad_();if(pending){if(pending.requestId!==input.requestId||_mwFpHash_(pending.input)!==_mwFpHash_(input))throw Error('Resume the pending request first');return _mwPrExecute_(pending);}
    var plan=_mwPrPlan_(input,actor);if(!p.previewToken||p.previewToken!==_mwFpHash_(plan.operations))throw Error('Data changed since preview. Preview again.');_mwPrStore_(plan);return _mwPrExecute_(plan);
  }finally{lock.releaseLock();}
}
function _mwPrResume_(p,actor){if(p.confirmed!=='YES')throw Error('Confirm resume');var lock=LockService.getScriptLock();if(!lock.tryLock(15000))throw Error('Payment operation busy');try{var plan=_mwPrLoad_();if(!plan||plan.requestId!==p.requestId)throw Error('Pending request not found');return _mwPrExecute_(plan);}finally{lock.releaseLock();}}
