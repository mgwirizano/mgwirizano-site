// Add this file to the existing project. Do not replace doGet or other bridges.
// New dashboard actions use POST only. No bank transfer or member-ledger writes.
var MW_FP = {
  leaderIds: ['MW0001','MW0005','MW0007','MW0324','MW0369','MW0031'],
  adminRate: 0.05,
  headers: ['Date','Fund Code','Amount','Description','SENT BY','Platform','Receiver','Notes']
};

// Insert one dispatch line at the start of your EXISTING doPost(e):
// var fpResponse = mwPayoutDashboardDispatch(e); if (fpResponse) return fpResponse;
function mwPayoutDashboardDispatch(e) {
  var p;
  try { p = JSON.parse(e && e.postData ? e.postData.contents : '{}'); }
  catch (_) { return null; }
  if (!/^fp_/.test(String(p.action || ''))) return null;
  var result;
  try {
    var actor = 'Dashboard entry (identity not verified)';
    var writes = ['fp_save','fp_review_apply','fp_review_resume'].indexOf(p.action) >= 0;
    // Check notification configuration before beginning a financial write.
    if (writes) _mwFpNotificationConfig_();
    if(p.action==='fp_version')result={status:'ok',version:'2026-11-22.3',actionsAvailable:typeof _mwActRoute_==='function',adminAvailable:typeof _mwAdminRoute_==='function',reviewAvailable:typeof _mwPrRoute_==='function'};
    else if (/^fp_actions_/.test(p.action))result=_mwActRoute_(p);
    else if (/^fp_admin_/.test(p.action)) result = _mwAdminRoute_(p);
    else if (/^fp_ops_/.test(p.action)) result = _mwOpsRoute_(p,actor);
    else if (/^fp_review_/.test(p.action)) result = _mwPrRoute_(p,actor);
    else if (p.action === 'fp_funds') result = {status:'ok', funds:_mwFpFunds_()};
    else if (p.action === 'fp_balance') result = getFundBalanceForDashboard(p);
    else if (p.action === 'fp_preview') result = _mwFpPreview_(p, actor);
    else if (p.action === 'fp_save') result = _mwFpSave_(p, actor);
    else throw new Error('Unknown payout action');
    if (writes && result.status === 'ok' && !result.alreadyRecorded) {
      var notice = _mwFpNotify_(p,result);
      result.notification = notice;
      result.message += ' ' + notice.message;
    }
    if(result.status==='ok'&&!result.alreadyRecorded&&['fp_save','fp_review_apply','fp_review_resume','fp_ops_stage_apply','fp_ops_notice_send','fp_admin_apply'].indexOf(p.action)>=0&&typeof _mwAdminLog_==='function'){try{_mwAdminLog_(p.action,p.requestId,result,p.task);}catch(logError){result.message=(result.message||'Action saved.')+' Activity logging needs review: '+logError.message;}}
  } catch (err) { result = {status:'error', message:err.message}; }
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}

// Uses the existing leadership notification address; no new login or PIN.
function _mwFpNotificationConfig_() {
  var cfg = getSettings();
  var email = String(cfg.leaderEmail || '').trim();
  if (!email) throw new Error('Leadership notification email is missing in settings. No new write started.');
  return {email:email,name:String(cfg.groupName || 'Mgwirizano Watsopano')};
}
function _mwFpNotify_(p,result) {
  // Called only after verified completion, never for previews or repeated requests.
  try {
    var cfg=_mwFpNotificationConfig_(),stamp=Utilities.formatDate(new Date(),_mwFpSS_().getSpreadsheetTimeZone(),'yyyy-MM-dd HH:mm:ss z');
    var lines=['Dashboard financial change completed','Timestamp: '+stamp,'Request ID: '+String(p.requestId || ''),'Action: '+p.action,
      'Source: dashboard entry; individual identity was not verified.'];
    if(p.action==='fp_save')lines=lines.concat(['PAYOUTS row: '+result.row,'Fund: '+String(p.fundCode || 'Organization'),
      'Amount: $'+Number(p.amount).toFixed(2),'Receiver: '+String(p.receiver || ''),'Bank reference: '+String(p.reference || '')]);
    else {lines.push('Mode: '+String(p.mode || ''));lines.push('Allocations: '+JSON.stringify(result.allocations || []));if(p.mode==='DISMISS')lines.push('Dismissed PAYMENTS row: '+p.sourceRow,'Reason: '+p.reason);}
    if(result.memberReceipts&&result.memberReceipts.length)lines.push('Member receipts: '+result.memberReceipts.map(function(r){return 'PAYMENTS row '+r.row+': '+r.status;}).join('; '));
    lines.push('This confirms a recorded change. It does not confirm a bank transfer.');
    var table=[['Member','Fund','Amount','Balance before','Balance after']].concat((result.allocations||[]).map(function(a){return [a.memberId,a.fundCode,'$'+Number(a.amount).toFixed(2),a.previousBalance===undefined?'—':'$'+Number(a.previousBalance).toFixed(2),a.newBalance===undefined?'—':'$'+Number(a.newBalance).toFixed(2)];}));var summary=lines.filter(function(line){return line.indexOf('Allocations: ')!==0;}).join('\n');var html=typeof _mwActHtml_==='function'?_mwActHtml_('Dashboard change recorded',summary,table):'<div style="font-family:Arial,sans-serif;white-space:pre-wrap">'+summary.replace(/[&<>]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c];})+'</div>';var sent=sendEmail(cfg.email,'Dashboard change recorded | '+cfg.name,summary,{htmlBody:html,name:cfg.name,replyTo:cfg.email});
    if(sent===false)throw new Error('Email helper did not confirm sending.');
    return {status:'sent',timestamp:stamp,message:'Confirmation email sent to '+cfg.email+'.'};
  } catch(err) {
    return {status:'failed',message:'Records were saved, but confirmation email failed: '+err.message+'. Do not repeat the payment.'};
  }
}

function _mwFpSS_() { return getSpreadsheet(); }
function _mwFpMoney_(v) {
  if (v === '' || v === null || v === undefined) return 0;
  if (typeof v !== 'number' || !isFinite(v)) throw new Error('A financial cell contains a non-numeric amount; review the sheet first.');
  return Math.round(v * 100);
}
function _mwFpFunds_() {
  var sheet = _mwFpSS_().getSheetByName('FUNDS');
  if (!sheet) throw new Error('FUNDS sheet missing');
  var seen = {}, memberNames = {}, members = _mwFpSS_().getSheetByName('MEMBERS');
  if (members) members.getDataRange().getValues().forEach(function(r){
    var id=String(r[16] || '').trim().toUpperCase();
    if (/^MW\d{4,6}$/.test(id)) memberNames[id]=memberNames[id] === undefined ? String(r[2] || '').trim() : '';
  });
  return sheet.getDataRange().getValues().filter(function(r){return /^FUND-\d{3}$/.test(String(r[0] || '').trim().toUpperCase());}).map(function(r){
    var code = String(r[0]).trim().toUpperCase();
    if (seen[code]) throw new Error('Duplicate FUNDS code: ' + code);
    seen[code] = true;
    var due=r[9] instanceof Date&&!isNaN(r[9].getTime())?Utilities.formatDate(r[9],_mwFpSS_().getSpreadsheetTimeZone(),'yyyy-MM-dd'):String(r[9]||'').trim(),recorded=String(r[8]||'').toUpperCase();
    return {code:code, deceased:String(r[2] || ''), recordedStatus:recorded,status:_mwFpCollectionStatus_(recorded,due), baseAmount:_mwFpMoney_(r[4])/100,
      bereaved:String(r[11] || '').trim().toUpperCase(),
      beneficiaryName:memberNames[String(r[11] || '').trim().toUpperCase()] || '',
      deadline:r[9] instanceof Date && !isNaN(r[9].getTime()) ? Utilities.formatDate(r[9],_mwFpSS_().getSpreadsheetTimeZone(),'yyyy-MM-dd') : String(r[9] || '').trim()};
  });
}
function _mwFpFund_(code) {
  code = String(code || '').trim().toUpperCase();
  var fund = _mwFpFunds_().filter(function(f){return f.code === code;})[0];
  if (!fund || fund.baseAmount <= 0) throw new Error('Select a valid fund with a positive contribution amount in FUNDS column E.');
  return fund;
}
function _mwFpPayoutSheet_() {
  var sheet = _mwFpSS_().getSheetByName('PAYOUTS');
  if (!sheet) throw new Error('PAYOUTS sheet missing. Existing history must be available before recording payments.');
  var values = sheet.getDataRange().getValues();
  var normalize = function(v){return String(v || '').trim().toLowerCase().replace(/\s+/g,' ');};
  MW_FP.headers.forEach(function(h,i){if (normalize(values[0][i]) !== normalize(h)) throw new Error('PAYOUTS header mismatch in column ' + (i+1) + '. Expected ' + h);});
  return {sheet:sheet, values:values};
}
function _mwFpPayouts_(fund, data) {
  var total = 0, other = 0, rows = [], warnings = [];
  data.slice(1).forEach(function(r,i){
    if (String(r[1] || '').trim().toUpperCase() !== fund.code) return;
    var amount = _mwFpMoney_(r[2]);
    if (amount < 0) throw new Error('Negative PAYOUTS amount at row ' + (i+2) + '; review before calculating.');
    var note = String(r[7] || ''), description = String(r[3] || '');
    var tag = /\[MWFP TYPE=(FAMILY|REFUND|EXPENSE|OTHER)\]/.exec(note);
    var type = tag ? tag[1] : /refund/i.test(description) ? 'REFUND' : /expense|subscription|software|fee/i.test(description) ? 'EXPENSE' : 'FAMILY';
    if (!tag && type === 'FAMILY') warnings.push('Legacy payout row ' + (i+2) + ' treated as family payment; confirm its description and receiver.');
    if (!(r[0] instanceof Date) || isNaN(r[0].getTime())) warnings.push('PAYOUTS row ' + (i+2) + ' has no valid payment date.');
    if (type === 'FAMILY') total += amount; else other += amount;
    rows.push({row:i+2,date:r[0] instanceof Date ? Utilities.formatDate(r[0],_mwFpSS_().getSpreadsheetTimeZone(),'yyyy-MM-dd') : String(r[0] || ''),
      amount:amount/100, description:description, sentBy:String(r[4]||''), platform:String(r[5]||''),receiver:String(r[6]||''),type:type});
  });
  return {familyCents:total, otherCents:other, rows:rows, warnings:warnings};
}

// Read-only. The family-pool method follows the supplied quickFundReport:
// full-paid/covered-by-credit headcount x fund base, plus capped partial payments,
// less 5% admin and recorded FAMILY payouts. This is not a bank reconciliation.
function getFundBalanceForDashboard(params) {
  var ss = _mwFpSS_(), fund = _mwFpFund_(params.fundCode);
  var track = ss.getSheetByName('TRACK-' + fund.code.slice(-3));
  if (!track) throw new Error('Tracker missing for ' + fund.code);
  var rows = track.getDataRange().getValues(), cap = Math.round(fund.baseAmount*100);
  var full=0, partial=0, base=0, gross=0, pending=0, excluded=0, credit=0, roster=[], seen={}, warnings=[];
  var exempt = {};
  MW_FP.leaderIds.forEach(function(id){exempt[id]=true;});
  if (fund.bereaved) exempt[fund.bereaved]=true;
  var exemptions = ss.getSheetByName('EXEMPTIONS');
  if (exemptions) {
    var ed = exemptions.getDataRange().getValues();
    var hi = ed.findIndex(function(r){return r.some(function(v){return /^member\s*id$/i.test(String(v).trim());}) && r.some(function(v){return /^fund(\s*code)?$/i.test(String(v).trim());});});
    if (hi < 0) throw new Error('Cannot identify EXEMPTIONS headers. Review before calculating.');
    var idCol=ed[hi].findIndex(function(v){return /^member\s*id$/i.test(String(v).trim());});
    var fc=ed[hi].findIndex(function(v){return /^fund(\s*code)?$/i.test(String(v).trim());});
    ed.slice(hi+1).forEach(function(r){var c=String(r[fc]||'').trim().toUpperCase();if(c==='ALL'||c===fund.code) exempt[String(r[idCol]||'').trim().toUpperCase()]=true;});
  }
  rows.slice(7).forEach(function(r,i){
    var id=String(r[0]||'').trim().toUpperCase();
    if (!/^MW\d{4,6}$/.test(id)) return;
    if (seen[id]) throw new Error('Duplicate tracker member: '+id);
    seen[id]=true;
    var status=String(r[7]||'').trim().toUpperCase(), paid=_mwFpMoney_(r[5]), note=String(r[8]||'');
    if(paid<0) throw new Error('Negative tracker payment for '+id);
    if(exempt[id] || /^EXEMPT\b/.test(status)){excluded++;return;}
    var contribution=0;
    if(status==='PAID'||status==='COVERED BY CREDIT'){
      full++;contribution=cap;gross+=paid;
      if(status==='COVERED BY CREDIT') credit++;
      if(paid<cap && status!=='COVERED BY CREDIT') warnings.push(id+' marked PAID with less than base recorded; confirm before relying on total.');
    }else if(status.indexOf('PARTIAL')>=0){
      partial++;gross+=paid;
      contribution=Math.min(cap, /late fee/i.test(note)?Math.max(0,paid-500):paid);
      if(/late fee/i.test(note)) warnings.push(id+' partial base assumes $5 of recorded paid amount is a late fee, matching the existing report; verify allocation.');
    }else{pending++;if(paid>0)warnings.push(id+' has a recorded payment but status '+status+'; excluded from pool by existing report method.');}
    base+=contribution;
    roster.push({memberId:id,name:String(r[1]||''),status:status,recordedPaid:paid/100,baseShare:contribution/100});
  });
  var payoutData=_mwFpPayoutSheet_(), payouts=_mwFpPayouts_(fund,payoutData.values);
  var admin=Math.round(base*MW_FP.adminRate),family=base-admin,remaining=family-payouts.familyCents;
  warnings=warnings.concat(payouts.warnings);
  warnings.push('Remaining is based on recorded data. Enter missing historical family payouts before treating it as payable. It is not the bank balance.');
  return {status:'ok',fund:fund,fullCount:full,partialCount:partial,pendingCount:pending,excludedCount:excluded,creditCount:credit,
    recordedCollected:gross/100,coreBase:base/100,adminFee:admin/100,familyShare:family/100,
    familyPaid:payouts.familyCents/100,otherOutgoings:payouts.otherCents/100,remaining:remaining/100,
    overpaid:Math.max(0,-remaining)/100,payouts:payouts.rows,roster:roster,warnings:warnings,
    calculatedAt:new Date().toISOString(),method:'Recorded core contributions less 5% admin less recorded family payouts; includes credited participation.'};
}

function _mwFpPayload_(p) {
  var amount=String(p.amount||'').trim();
  if(!/^\d+(\.\d{1,2})?$/.test(amount)||Number(amount)<=0||Number(amount)>1000000) throw new Error('Enter a positive dollar amount, with at most two decimal places.');
  var date=String(p.date||'');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Enter the actual payment date.');
  var parsed=new Date(date+'T12:00:00Z');
  if(isNaN(parsed.getTime())||parsed.toISOString().slice(0,10)!==date) throw new Error('Invalid payment date.');
  var today=Utilities.formatDate(new Date(),_mwFpSS_().getSpreadsheetTimeZone(),'yyyy-MM-dd');
  if(date>today) throw new Error('Record payments already sent; future dates are not allowed.');
  var type=String(p.type||'').toUpperCase();
  if(['FAMILY','REFUND','EXPENSE','OTHER'].indexOf(type)<0) throw new Error('Select payment category.');
  var code=String(p.fundCode||'').trim().toUpperCase();
  if(code) _mwFpFund_(code); else if(type==='FAMILY') throw new Error('Family payment requires a fund.');
  var out={fundCode:code,type:type,date:date,amount:Number(amount),requestId:String(p.requestId||''),reserveAdvance:p.reserveAdvance==='YES'};
  ['description','platform','receiver','reference','notes'].forEach(function(k){out[k]=String(p[k]||'').trim();if(out[k].length>500||/[\r\n\[\]]/.test(out[k]))throw new Error('Invalid '+k+'; use one line without square brackets.');});
  if(!out.description||!out.receiver||!out.platform||!out.reference) throw new Error('Description, receiver, platform and bank reference are required.');
  if(!/^[a-zA-Z0-9-]{16,80}$/.test(out.requestId))throw new Error('Payment request ID missing. Reload payout form.');
  return out;
}
function _mwFpExisting_(payload, data) {
  var existing=null;
  data.slice(1).forEach(function(r,i){
    var note=String(r[7]||'');
    if(note.indexOf('[MWFP ID='+payload.requestId+']')>=0){
      if(existing)throw new Error('Duplicate saved request IDs require review.');
      existing={row:i+2,notes:note};
    }
    // Reference identifies a single bank transfer. Do not record a transfer twice.
    if(note.indexOf('[MWFP REF='+payload.reference.toUpperCase()+']')>=0 && note.indexOf('[MWFP ID='+payload.requestId+']')<0)
      throw new Error('Bank reference is already recorded at PAYOUTS row '+(i+2)+'.');
    if(note.indexOf('[MWFP ID=')<0 && String(r[1]||'').trim().toUpperCase()===payload.fundCode &&
       _mwFpMoney_(r[2])===Math.round(payload.amount*100) && String(r[6]||'').trim().toLowerCase()===payload.receiver.toLowerCase() &&
       r[0] instanceof Date && Utilities.formatDate(r[0],_mwFpSS_().getSpreadsheetTimeZone(),'yyyy-MM-dd')===payload.date)
      throw new Error('Possible historical duplicate at PAYOUTS row '+(i+2)+'. Review that record instead of adding another.');
  });
  return existing;
}
function _mwFpHash_(obj){return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,JSON.stringify(obj)));}
function _mwFpSignature_(payload, data, summary){return _mwFpHash_({payload:payload,data:data,summary:summary?{base:summary.coreBase,paid:summary.familyPaid,remaining:summary.remaining}:null});}
function _mwFpPreview_(p, actor) {
  var payload=_mwFpPayload_(p),data=_mwFpPayoutSheet_().values,existing=_mwFpExisting_(payload,data);
  var summary=payload.fundCode?getFundBalanceForDashboard(payload):null;
  var allowed=payload.type!=='FAMILY'||payload.reserveAdvance||payload.amount<=Math.max(0,summary.remaining);
  return {status:'ok',dryRun:true,alreadyRecorded:!!existing,row:existing?existing.row:null,payment:payload,recordedBy:actor,
    canSave:allowed,previewToken:_mwFpSignature_(payload,data,summary),summary:summary,
    remainingAfter:summary?Math.round((summary.remaining-(payload.type==='FAMILY'?payload.amount:0))*100)/100:null,
    message:existing?'This request is already recorded. No second row will be added.':allowed?'Preview only. No rows changed.':'Amount exceeds the recorded remaining family share. Review the calculation and existing payouts.'};
}
function _mwFpSafeText_(text){return /^[=+\-@]/.test(String(text))?"'"+text:String(text);}
function _mwFpSave_(p, actor) {
  if(p.confirmed!=='YES')throw new Error('Preview and confirm the payment before saving.');
  var lock=LockService.getScriptLock();
  if(!lock.tryLock(15000))throw new Error('Another operation is running. Retry the same request.');
  try{
    var payload=_mwFpPayload_(p),info=_mwFpPayoutSheet_(),existing=_mwFpExisting_(payload,info.values);
    var payloadHash=_mwFpHash_(payload);
    if(existing){
      if(existing.notes.indexOf('[MWFP HASH='+payloadHash+']')<0)throw new Error('Request ID belongs to different details. Review the saved record.');
      return {status:'ok',alreadyRecorded:true,row:existing.row,message:'Already recorded. No duplicate added.'};
    }
    var summary=payload.fundCode?getFundBalanceForDashboard(payload):null;
    if(!p.previewToken||p.previewToken!==_mwFpSignature_(payload,info.values,summary))throw new Error('Data changed since preview. Preview again before saving.');
    if(payload.type==='FAMILY'&&!payload.reserveAdvance&&payload.amount>Math.max(0,summary.remaining))throw new Error('Payment exceeds recorded remaining family share.');
    var tz=_mwFpSS_().getSpreadsheetTimeZone();
    var date=Utilities.parseDate(payload.date+' 12:00:00',tz,'yyyy-MM-dd HH:mm:ss');
    var notes=(payload.notes?payload.notes+' | ':'')+(payload.reserveAdvance?'Advance from reserves acknowledged | ':'')+'[MWFP TYPE='+payload.type+'] [MWFP ID='+payload.requestId+'] [MWFP REF='+payload.reference.toUpperCase()+'] [MWFP HASH='+payloadHash+'] Recorded by '+actor+' at '+new Date().toISOString();
    var row=[date,payload.fundCode,payload.amount,_mwFpSafeText_(payload.description),actor,_mwFpSafeText_(payload.platform),_mwFpSafeText_(payload.receiver),_mwFpSafeText_(notes)];
    var target=info.sheet.getLastRow()+1;
    info.sheet.getRange(target,1,1,8).setValues([row]);
    SpreadsheetApp.flush();
    var actual=info.sheet.getRange(target,1,1,8).getValues()[0];
    if(_mwFpMoney_(actual[2])!==Math.round(payload.amount*100)||String(actual[7]).indexOf('[MWFP ID='+payload.requestId+']')<0)
      throw new Error('Write outcome needs checking. Do not start a new request; retry this request ID.');
    return {status:'ok',row:target,message:'Payment recorded in PAYOUTS row '+target+'. No money transferred.',
      summary:payload.fundCode?getFundBalanceForDashboard(payload):null};
  }finally{lock.releaseLock();}
}

function _mwFpCollectionStatus_(status,deadline,today){today=today||Utilities.formatDate(new Date(),'America/Los_Angeles','yyyy-MM-dd');return status==='ACTIVE'&&/^\d{4}-\d{2}-\d{2}$/.test(deadline||'')&&deadline<today?'CLOSED':status;}
