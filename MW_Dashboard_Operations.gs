// Optional dashboard operations. Never run scanner/reconciliation or send notices on page load.
function _mwOpsRoute_(p,actor){
  MWPR_READ_CACHE={};MWPR_SS=null;
  if(p.action==='fp_ops_service_preview')return _mwAutoRun_(false);
  if(p.action==='fp_ops_service')return _mwAutoDashboard_();
  if(p.action==='fp_ops_zelle_check')return _mwOpsZelleCheck_(p);
  if(p.action==='fp_ops_mail')return _mwOpsMailQueue_(p);
  if(p.action==='fp_ops_stage_preview')return _mwOpsStagePreview_(p);
  if(p.action==='fp_ops_stage_apply')return _mwOpsStageApply_(p);
  if(p.action==='fp_ops_alerts')return _mwOpsAlerts_();
  if(p.action==='fp_ops_notices')return p.noticeKind==='REGISTRATION'?_mwOpsRegistrationList_():_mwOpsNoticeList_();
  if(p.action==='fp_ops_notice_preview')return _mwOpsNoticePreview_(p);
  if(p.action==='fp_ops_notice_send')return _mwOpsNoticeSend_(p);
  throw Error('Unknown dashboard operation');
}
function _mwOpsMailSource_(msg){
  var cfg=getSettings(),from=String(msg.getFrom()||'').toLowerCase(),expected=String(cfg.zelleFrom||'').toLowerCase();
  var email=(from.match(/<([^>]+)>/)||[])[1]||from.trim();
  if(!expected||email!==expected||!/you received money with zelle/i.test(msg.getSubject()||''))throw Error('Email is not a verified configured bank notice');
  if(typeof parseZelleAmount!=='function'||typeof extractMemberIdsAndNames!=='function')throw Error('Current Zelle parser functions are missing. No email can be imported.');
  var body=msg.getPlainBody(),amount=Number(parseZelleAmount(body)),sender=(body.match(/^([^\n]+?)\s+sent you money/im)||[])[1];
  var extracted=extractMemberIdsAndNames(body),tx=(body.match(/Transaction number[\s*:]*([0-9]+)/i)||[])[1]||'';
  if(!sender||!isFinite(amount)||amount<=0)throw Error('Sender or amount could not be verified. Review the original bank email.');
  return {messageId:msg.getId(),transactionId:tx,date:msg.getDate(),sender:sender.trim(),amount:amount,memo:String(extracted.rawMemo||''),memberIds:typeof _mwAdminMemoHints_==='function'?_mwAdminMemoHints_(String(extracted.rawMemo||'')).memberIds:[]};
}
function _mwOpsMailCheck_(source,ledger){
  var ss=_mwPrSS_(),tz=ss.getSpreadsheetTimeZone(),day=Utilities.formatDate(source.date,tz,'yyyyMMdd'),dayKey=Utilities.formatDate(source.date,Session.getScriptTimeZone()||tz,'yyyy/MM/dd');
  var state=typeof _loadZelleDayState_==='function'?_loadZelleDayState_(dayKey):null,status=state?String(state[source.messageId]||''):'';
  var exact=[],possible=[],sender=source.sender.toUpperCase().replace(/[^A-Z0-9]/g,'');
  ledger.rows.forEach(function(r){
    if(r.notes.indexOf('[MWOPS EMAIL='+source.messageId+' ')>=0||(source.transactionId&&new RegExp('(?:^|[^0-9])'+source.transactionId+'(?:[^0-9]|$)').test(r.notes+' '+r.memo)))exact.push(r.row);
    else if(r.raw[ledger.map.date] instanceof Date&&Utilities.formatDate(r.raw[ledger.map.date],tz,'yyyyMMdd')===day&&r.sender.toUpperCase().replace(/[^A-Z0-9]/g,'')===sender)possible.push(r.row);
  });
  var reasons=[];if(exact.length)reasons.push('Source already referenced in PAYMENTS rows '+exact.join(', '));
  if(possible.length)reasons.push('Possible existing or split transaction from this sender that day: rows '+possible.join(', ')+'. Inspect before importing.');
  if(!state||typeof _saveZelleDayState_!=='function')reasons.push('Compatible scanner checkpoint helpers missing; staging disabled.');
  if(status&&status!=='REVIEW')reasons.push('Scanner already marked this message '+status+'; manual investigation required.');
  return {dayKey:dayKey,state:status,exactRows:exact,candidateRows:possible,canStage:!reasons.length,reasons:reasons};
}
function _mwOpsMailQueue_(p){
  var cfg=getSettings();if(!cfg.zelleFrom)throw Error('Configured bank sender is missing');
  var period=typeof _mwAdminPeriod_==='function'?_mwAdminPeriod_(p):null;if(!period)throw Error('Install the guided admin module for calendar inspection');
  var offset=Math.max(0,parseInt(p.offset,10)||0),queryStart=new Date(period.start+'T12:00:00Z');queryStart.setUTCDate(queryStart.getUTCDate()-1);
  var queryEnd=new Date(period.end+'T12:00:00Z');queryEnd.setUTCDate(queryEnd.getUTCDate()+2);
  var threads=GmailApp.search('from:'+cfg.zelleFrom+' subject:"You received money with Zelle" after:'+queryStart.toISOString().slice(0,10).replace(/-/g,'/')+' before:'+queryEnd.toISOString().slice(0,10).replace(/-/g,'/'),offset,50),ledger=_mwPrLedger_(),rows=[],seen={};
  threads.forEach(function(thread){thread.getMessages().forEach(function(msg){var day=Utilities.formatDate(msg.getDate(),period.tz,'yyyy-MM-dd');if(day<period.start||day>period.end||seen[msg.getId()])return;seen[msg.getId()]=true;
    try{var source=_mwOpsMailSource_(msg),check=_mwOpsMailCheck_(source,ledger);rows.push({messageId:source.messageId,transactionId:source.transactionId,date:_mwPrDate_(source.date),sender:source.sender,amount:source.amount,memo:source.memo,memberIds:source.memberIds,check:check});}
    catch(err){rows.push({messageId:msg.getId(),date:_mwPrDate_(msg.getDate()),error:err.message});}
  });});rows.sort(function(a,b){return b.date.localeCompare(a.date);});
  return {status:'ok',messages:rows,offset:offset,nextOffset:threads.length===50?offset+50:null,period:period,message:'READ ONLY: '+period.start+' through '+period.end+' ('+period.tz+'). No labels, checkpoints or sheets changed. Use Next for remaining conversations.'};
}
function _mwOpsStagePlan_(p){
  if(!/^[A-Za-z0-9-]{16,80}$/.test(String(p.requestId||''))||!p.messageId)throw Error('Import request ID and email ID required');
  var source=_mwOpsMailSource_(GmailApp.getMessageById(String(p.messageId))),ledger=_mwPrLedger_(),check=_mwOpsMailCheck_(source,ledger);
  var own=ledger.rows.filter(function(r){return r.notes.indexOf('[MWOPS EMAIL='+source.messageId+' ')>=0;});
  if(own.length===1)return {alreadyRecorded:true,row:own[0].row};if(own.length>1)throw Error('Duplicate source markers; manual review required');
  if(!check.canStage)throw Error(check.reasons.join(' '));
  return {source:source,check:check,ledger:ledger,token:_mwFpHash_({source:_mwPrPack_(source),state:check.state,rows:ledger.data})};
}
function _mwOpsStagePreview_(p){var plan=_mwOpsStagePlan_(p);return {status:'ok',alreadyRecorded:!!plan.alreadyRecorded,row:plan.row,previewToken:plan.token,source:plan.source?_mwPrPack_(plan.source):null,message:plan.alreadyRecorded?'Email already staged. Open that PAYMENTS row.':'Preview only: stage this verified bank email as one UNMATCHED source row. No contribution is applied. Scanner checkpoint will be held at REVIEW.'};}
function _mwOpsStageApply_(p){
  if(p.confirmed!=='YES')throw Error('Preview and confirm import first');var lock=LockService.getScriptLock();if(!lock.tryLock(15000))throw Error('Scanner or payment operation busy');
  try{var plan=_mwOpsStagePlan_(p);if(plan.alreadyRecorded)return {status:'ok',alreadyRecorded:true,row:plan.row,message:'Already staged. No duplicate source added.'};
    if(!p.previewToken||p.previewToken!==plan.token)throw Error('Mailbox or ledger changed since preview. Preview again.');
    var source=plan.source,ledger=plan.ledger,map=ledger.map,state=_loadZelleDayState_(plan.check.dayKey);
    // Reserve before staging. If interrupted, scanner cannot independently allocate this source.
    state[source.messageId]='REVIEW';_saveZelleDayState_(plan.check.dayKey,state);
    var values=Array(ledger.data[ledger.header].length).fill(''),row=ledger.sheet.getLastRow()+1;
    values[map.date]=source.date;values[map.id]='UNMATCHED';values[map.name]=_mwFpSafeText_(source.sender);values[map.amount]=source.amount;values[map.type]='Unknown';values[map.fund]='?';values[map.sender]=_mwFpSafeText_(source.sender);values[map.memo]=_mwFpSafeText_(source.memo);values[map.status]='UNMATCHED';values[map.processed]=new Date();values[map.email]='NOT SENT';values[map.notes]='[MWOPS EMAIL='+source.messageId+' TX='+source.transactionId+'] Staged for explicit dashboard allocation; request '+p.requestId;
    ledger.sheet.getRange(row,1,1,values.length).setValues([values]);SpreadsheetApp.flush();
    var actual=ledger.sheet.getRange(row,1,1,values.length).getValues()[0];if(String(actual[map.notes]).indexOf('[MWOPS EMAIL='+source.messageId+' ')<0||Number(actual[map.amount])!==source.amount)throw Error('Staging outcome needs verification. Retry same email, not a new payment.');
    return {status:'ok',row:row,message:'Bank email staged as PAYMENTS row '+row+'. Open Zelle review to allocate it. No fund payment, credit or bank transfer was applied.'};
  }finally{lock.releaseLock();}
}
function _mwOpsReviewIndex_(){
  var sh=_mwPrSS_().getSheetByName('REMOVAL REVIEW'),index={};if(!sh)return index;
  var rows=sh.getDataRange().getValues(),expected=['Decision','Member ID','Member Name','Email','Missed Count','Outstanding Funds','System Total','Deadline','Investigation Notes','Last Evaluated','Send Status','Sent At'];
  expected.forEach(function(h,i){if(String(rows[0][i]||'').trim()!==h)throw Error('REMOVAL REVIEW header mismatch. No warning emails can be sent.');});
  rows.slice(1).forEach(function(r,i){var id=_mwPrId_(r[1]);if(!id)return;if(index[id])throw Error('Duplicate REMOVAL REVIEW member');index[id]={row:i+2,decision:String(r[0]||'HOLD').toUpperCase(),sendStatus:String(r[10]||'').toUpperCase(),values:r.slice(0,12)};});return index;
}
function _mwOpsNoticeList_(context){
  context=context||{};var ss=_mwPrSS_(),funds=context.funds||_mwFpFunds_(),ledger=context.ledger||_mwPrLedger_(),today=Utilities.formatDate(new Date(),'America/Chicago','yyyy-MM-dd'),index=context.index||_mwOpsReviewIndex_(),potential={},members={},warnings=[];
  _mwPrValues_(ss.getSheetByName('MEMBERS')).forEach(function(r){var id=_mwPrId_(r[16]);if(id)members[id]={id:id,name:_mwPrText_(r[2]),email:_mwPrText_(r[1])};});
  var overdue=funds.filter(function(f){return /^\d{4}-\d{2}-\d{2}$/.test(f.deadline)&&f.deadline<today;});
  overdue.forEach(function(f){var sh=ss.getSheetByName('TRACK-'+f.code.slice(-3));if(!sh){warnings.push(f.code+': tracker missing');return;}
    var trackRows=_mwPrValues_(sh);if(typeof _terminationIncludeApprovedTrackGaps_==='function')trackRows=_terminationIncludeApprovedTrackGaps_(trackRows,f.code,members);
    trackRows.slice(7).forEach(function(r){var id=_mwPrId_(r[0]);if(!members[id]||/^(PAID|EXEMPT)|COVERED/i.test(String(r[7]))||/^HOLD/i.test(String(r[8]))||(Number(r[4])<=0&&!/ADMIN-REVIEWED TRACK GAP/.test(String(r[8]))))return;(potential[id]||(potential[id]=[])).push(f.code);});});
  var recipients=[];
  Object.keys(potential).filter(function(id){return potential[id].length>=4;}).forEach(function(id){var m=members[id],obligations=[],issues=[];
    potential[id].forEach(function(code){var o=_mwPrObligation_(id,code,ledger);if(o.status==='EXEMPT'||o.balance===0)return;if(o.status==='REVIEW'||o.balance===null)issues.push(code+': '+o.issues.join('; '));obligations.push(o);});
    if(obligations.length<4)return;var prior=index[id]||{decision:'HOLD',sendStatus:''};
    var blocked=issues.slice();if(_mwOpsNoticeHeld_(id,context))blocked.push('A previous warning delivery is sent or uncertain; inspect notice audit');if(!/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(m.email))blocked.push('Member email missing or invalid');if(['EXCLUDE','RESOLVED'].indexOf(prior.decision)>=0)blocked.push('Existing review decision '+prior.decision);if(prior.sendStatus&&prior.sendStatus!=='NOT SENT')blocked.push('Warning already sent; original history retained');
    recipients.push({memberId:id,name:m.name,email:m.email,missed:obligations.length,total:Math.round(obligations.reduce(function(a,o){return a+Number(o.balance||0);},0)*100)/100,obligations:obligations,decision:prior.decision,sendStatus:prior.sendStatus,issues:issues,blocked:blocked,canSend:!blocked.length,review:prior});
  });
  recipients.sort(function(a,b){return b.missed-a.missed||a.name.localeCompare(b.name);});
  return {status:'ok',minimumMissedFunds:4,members:recipients,warnings:warnings,message:'Read-only review: four or more overdue funds. Exemptions, existing exclusions and previously sent warnings are protected. No membership removals are performed.'};
}
function _mwOpsNoticePlan_(p){
  var ids=p.memberIds;if(!Array.isArray(ids)||!ids.length||ids.length>10||ids.some(function(id,i){return !_mwPrId_(id)||ids.indexOf(id)!==i;}))throw Error('Select 1–10 distinct members');
  if(p.noticeKind!=='REGISTRATION'&&typeof _buildTerminationNoticeEmail!=='function')throw Error('Existing termination notice email builder is missing; add your existing notice script unchanged.');
  if(typeof _mwAutoAssertNoDispute_==='function')ids.forEach(_mwAutoAssertNoDispute_);
  var cfg=getSettings(),noticeDays=7,today=Utilities.formatDate(new Date(),'America/Chicago','yyyy-MM-dd'),deadline=String(p.deadline||'');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(deadline)||isNaN(new Date(deadline+'T12:00:00Z').getTime())||new Date(deadline+'T12:00:00Z').toISOString().slice(0,10)!==deadline)throw Error('Choose a valid warning deadline');
  var min=new Date(today+'T12:00:00Z');min.setUTCDate(min.getUTCDate()+noticeDays);if(deadline<min.toISOString().slice(0,10))throw Error('Allow at least seven calendar days for the warning deadline');
  var list=p.noticeKind==='REGISTRATION'?_mwOpsRegistrationList_():_mwOpsNoticeList_(),selected=ids.map(function(id){var m=list.members.filter(function(x){return x.memberId===id;})[0];if(!m||!m.canSend)throw Error(id+': '+(m?m.blocked.join('; '):'no longer qualifies'));return m;});
  var messages=selected.map(function(m){var member={id:m.memberId,name:m.name,email:m.email,total:m.total,funds:m.obligations.map(function(o){return {code:o.fundCode,deceased:o.deceased,closed:o.deadline,amount:o.balance,contribution:Math.max(0,o.balance-o.lateFee),lateFee:o.lateFee,memo:m.memberId+' '+o.fundCode,lastName:(o.deceased||'').split(/\s+/).pop()};})};return {member:member,message:p.noticeKind==='REGISTRATION'?_mwOpsRegistrationMessage_(cfg,member,deadline):_buildTerminationNoticeEmail(cfg,member,deadline,noticeDays),review:m.review};});
  return {messages:messages,deadline:deadline,token:_mwFpHash_({deadline:deadline,messages:messages})};
}
function _mwOpsNoticePreview_(p){var plan=_mwOpsNoticePlan_(p);return {status:'ok',dryRun:true,previewToken:plan.token,deadline:plan.deadline,messages:plan.messages.map(function(x){return {memberId:x.member.id,email:x.member.email,subject:x.message.subject,text:x.message.text,missed:x.member.funds.length,total:x.member.total};}),message:'Preview only. No emails, review decisions or memberships changed.'};}
function _mwOpsNoticeSend_(p){
  if(p.confirmed!=='YES')throw Error('Preview and confirm the selected warning emails first');var lock=LockService.getScriptLock();if(!lock.tryLock(15000))throw Error('Another administrative action is running');
  try{_mwFpNotificationConfig_();var plan=_mwOpsNoticePlan_(p);if(!p.previewToken||p.previewToken!==plan.token)throw Error('Member balances or review decisions changed. Preview again.');
    var ss=_mwPrSS_(),cfg=getSettings(),audit=ss.getSheetByName('MW_DASHBOARD_NOTICES'),results=[];
    if(!audit){audit=ss.insertSheet('MW_DASHBOARD_NOTICES');audit.getRange(1,1,1,7).setValues([['Key','Member ID','Deadline','Status','Started At','Completed At','Details']]);}
    var history=audit.getDataRange().getValues();
    plan.messages.forEach(function(item){var key=item.member.id+'|'+plan.deadline,old=history.filter(function(r){return r[0]===key;});if(old.length){results.push({memberId:item.member.id,status:'HELD',message:'Already sent or uncertain prior delivery; inspect notice audit before retrying.'});return;}
      var row=audit.getLastRow()+1;audit.getRange(row,1,1,7).setValues([[key,item.member.id,plan.deadline,'SENDING',new Date(),'','']]);SpreadsheetApp.flush();
      try{var sent=sendEmail(item.member.email,item.message.subject,item.message.text,{htmlBody:item.message.html,name:cfg.groupName+' — Leadership',replyTo:cfg.leaderEmail});if(!sent)throw Error('Email helper did not confirm delivery');
        audit.getRange(row,4,1,4).setValues([['SENT',new Date(),new Date(),'Warning sent to '+item.member.email]]);
        // Update only the selected existing review row. Never clear or rebuild REMOVAL REVIEW.
        var review=ss.getSheetByName('REMOVAL REVIEW');
        if(!review){review=ss.insertSheet('REMOVAL REVIEW');review.getRange(1,1,1,12).setValues([['Decision','Member ID','Member Name','Email','Missed Count','Outstanding Funds','System Total','Deadline','Investigation Notes','Last Evaluated','Send Status','Sent At']]);}
        if(item.review.row){review.getRange(item.review.row,1).setValues([['PROCEED']]);review.getRange(item.review.row,5,1,4).setValues([[item.member.funds.length,item.member.funds.map(function(f){return f.code;}).join(', '),item.member.total,plan.deadline]]);review.getRange(item.review.row,11,1,2).setValues([['SENT',new Date()]]);}
        else review.getRange(review.getLastRow()+1,1,1,12).setValues([['PROCEED',item.member.id,item.member.name,item.member.email,item.member.funds.length,item.member.funds.map(function(f){return f.code;}).join(', '),item.member.total,plan.deadline,'Selected and confirmed on dashboard',new Date(),'SENT',new Date()]]);
        results.push({memberId:item.member.id,status:'SENT'});
      }catch(err){audit.getRange(row,4).setValues([['UNCERTAIN']]);audit.getRange(row,7).setValues([[String(err.message)]]);results.push({memberId:item.member.id,status:'UNCERTAIN',message:'Delivery may have occurred. Inspect audit and sent mail; no automatic resend.'});}
    });return {status:'ok',results:results,message:'Selected warning run finished. Memberships were not removed.'};
  }finally{lock.releaseLock();}
}

// Dashboard notifications are evaluated read-only. No scheduled emails or automatic removals.
function _mwOpsToday_(){return Utilities.formatDate(new Date(),'America/Chicago','yyyy-MM-dd');}
function _mwOpsDay_(v){if(v instanceof Date)return Utilities.formatDate(v,'America/Chicago','yyyy-MM-dd');var d=String(v||'').slice(0,10);return /^\d{4}-\d{2}-\d{2}$/.test(d)?d:'';}
function _mwOpsWindow_(){var raw=PropertiesService.getScriptProperties().getProperty('MW_REGISTRATION_WINDOW');return raw?JSON.parse(raw):null;}
function _mwOpsNoticeHeld_(id,context){var sh,rows;if(context){if(!context.noticeAudit){sh=_mwPrSS_().getSheetByName('MW_DASHBOARD_NOTICES');context.noticeAudit=sh?sh.getDataRange().getValues().slice(1):[];}rows=context.noticeAudit;}else{sh=_mwPrSS_().getSheetByName('MW_DASHBOARD_NOTICES');rows=sh?sh.getDataRange().getValues().slice(1):[];}return rows.some(function(r){return r[1]===id&&/SENT|SENDING|UNCERTAIN/.test(String(r[3]));});}
function _mwOpsRegistrationList_(context){
 var w=_mwOpsWindow_(),today=_mwOpsToday_(),index=context&&context.index||_mwOpsReviewIndex_();if(!w||today<=w.end)return {status:'ok',members:[],warnings:[],message:w?'Registration window has not closed.':'Set the registration window dates before activating registration-fee alerts.'};
 var reg=context?(context.registration||(context.registration=_mwActRegistration_({},context.ledger))):_mwActRegistration_({joinedFrom:w.start,joinedTo:w.end}),cohort=reg.members.filter(function(m){return m.joined&&m.joined>=w.start&&m.joined<=w.end;});return {status:'ok',members:cohort.filter(function(m){return m.regStatus!=='REVIEW'&&m.regBalance>0;}).map(function(m){var prior=index[m.id]||{decision:'HOLD',sendStatus:''},blocked=[];if(_mwOpsNoticeHeld_(m.id,context)||prior.sendStatus)blocked.push('Prior warning sent or uncertain; review existing history');if(['EXCLUDE','RESOLVED'].indexOf(prior.decision)>=0)blocked.push('Existing review decision '+prior.decision);if(!/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(m.email))blocked.push('Valid email required');return {memberId:m.id,name:m.name,email:m.email,missed:0,total:m.regBalance,obligations:[{fundCode:'REG',deceased:'Registration fee',deadline:w.end,balance:m.regBalance,lateFee:0}],review:prior,decision:prior.decision,sendStatus:prior.sendStatus,blocked:blocked,canSend:!blocked.length};}),warnings:cohort.filter(function(m){return m.regStatus==='REVIEW';}).map(function(m){return m.id+': registration record needs verification';}),message:'Unpaid registration fees for members who joined within '+w.start+' through '+w.end+'. No automatic removal.'};
}
function _mwOpsRegistrationMessage_(cfg,m,deadline){var text='Dear '+m.name+',\n\nYour registration fee has an outstanding verified balance of $'+m.total.toFixed(2)+'. The registration window has closed. Please pay or contact leadership by '+deadline+' to discuss your circumstances.\n\nZelle: '+cfg.zelleEmail+'\nMemo: '+m.id+' Registration Fee\n\nThis is a registration fee, separate from funeral contributions. If you believe you paid, contact '+cfg.leaderEmail+' so we can verify your record. You may present your case before any Board-reviewed membership action. No removal occurs automatically.\n\n'+cfg.groupName;return {subject:'Registration payment warning — '+m.id,text:text,html:_mwActHtml_('Registration payment warning',text)};}
function _mwOpsNotifiedBalance_(id,review,context){
 var codes=String(review.values[5]).match(/FUND-\d{3}|\bREG\b/g)||[];if(!codes.length)throw Error('No original notified obligations');
 if(codes.indexOf('REG')>=0){if(codes.length!==1)throw Error('Mixed notice types need manual review');var registration=context?(context.registration||(context.registration=_mwActRegistration_({},context.ledger))):_mwActRegistration_({});var m=registration.members.filter(function(x){return x.id===id;})[0];if(!m||m.regStatus==='REVIEW')throw Error('Registration balance needs verification');return {total:m.regBalance,kind:'REGISTRATION'};}
 var ledger=context&&context.ledger||_mwPrLedger_(),total=0;codes.forEach(function(code){var o=_mwPrObligation_(id,code,ledger);if(o.status==='REVIEW'||o.balance===null)throw Error(code+': balance needs verification');total+=Number(o.balance||0);});return {total:Math.round(total*100)/100,kind:'FUNDS'};
}
// Same original four-fund / original-warning-deadline decisions, evaluated against
// one request-local read snapshot. No cross-request cache and no write methods.
function _mwOpsAlerts_(){
 var previous=MWPR_SS,previousCache=MWPR_READ_CACHE,live=_mwPrSS_(),sheets=live.getSheets(),byName={},tz=live.getSpreadsheetTimeZone();
 sheets.forEach(function(sheet){var name=sheet.getName(),values;byName[name]={getName:function(){return name;},getDataRange:function(){return {getValues:function(){return values||(values=sheet.getDataRange().getValues());}};}};});
 MWPR_SS={getSheetByName:function(name){return byName[name]||null;},getSheets:function(){return Object.keys(byName).map(function(name){return byName[name];});},getSpreadsheetTimeZone:function(){return tz;}};
 MWPR_READ_CACHE={};
 try{return _mwOpsAlertsRead_();}finally{MWPR_SS=previous;MWPR_READ_CACHE=previousCache;}
}
function _mwOpsAlertsRead_(){
 var context={ledger:_mwPrLedger_(),funds:_mwFpFunds_(),index:_mwOpsReviewIndex_()},funds=_mwOpsNoticeList_(context),reg=_mwOpsRegistrationList_(context),index=context.index,rows=[],seen={},today=_mwOpsToday_();
 funds.members.concat(reg.members).forEach(function(m){if(seen[m.memberId])return;seen[m.memberId]=true;rows.push({memberId:m.memberId,name:m.name,state:m.canSend?'WARNING NEEDED':'REVIEW NEEDED',kind:m.obligations[0].fundCode==='REG'?'REGISTRATION':'FUNDS',missed:m.missed,total:m.total,reason:m.blocked.join('; ')});});
 Object.keys(index).forEach(function(id){var r=index[id];if(r.sendStatus!=='SENT'||r.decision!=='PROCEED'||!(r.values[11] instanceof Date))return;try{_mwPrMember_(id);var b=_mwOpsNotifiedBalance_(id,r,context),deadline=_mwOpsDay_(r.values[7]);if(!deadline)throw Error('Notice deadline missing');var alert={memberId:id,name:String(r.values[2]),state:b.total<=0?'RESOLVED':deadline<today?'REMOVAL REVIEW NEEDED':'AWAITING RESPONSE',kind:b.kind,total:b.total,deadline:deadline,reason:'Only the obligations in the original sent warning are checked.'};rows=rows.filter(function(x){return x.memberId!==id;});rows.push(alert);}catch(err){rows=rows.filter(function(x){return x.memberId!==id;});rows.push({memberId:id,name:String(r.values[2]),state:'REVIEW NEEDED',reason:err.message});}});
 var cleanupRows=0;try{cleanupRows=_mwOpsCleanupCount_();}catch(err){funds.warnings.push('Cleanup needs review: '+err.message);}
 return {status:'ok',threshold:4,window:_mwOpsWindow_(),rows:rows,warningNeeded:rows.filter(function(r){return r.state==='WARNING NEEDED';}).length,removalReview:rows.filter(function(r){return r.state==='REMOVAL REVIEW NEEDED';}).length,cleanupRows:cleanupRows,warnings:funds.warnings.concat(reg.warnings),message:'Read-only alerts. Review and confirm every email, removal and archived cleanup.'};
}

// Guided audit: strict bank source + current ledger/TRACK/fund-log checks. Never invokes auto-fix.
function _mwOpsZelleCheck_(p){var scan=_mwAdminInspect_(p),ledger=_mwPrLedger_(),ss=_mwPrSS_(),tz=ss.getSpreadsheetTimeZone(),stats={missing:0,review:0,recorded:0};scan.items.forEach(function(item){var notes=[];(item.candidateRows||[]).filter(function(r){return r.allocated&&/^funeral contribution$/i.test(r.type);}).forEach(function(r){try{var o=_mwPrObligation_(r.memberId,r.fund,ledger);if(o.status==='REVIEW')notes.push(r.memberId+' '+r.fund+': '+o.issues.join('; '));var sh=ss.getSheetByName(r.fund);if(!sh){notes.push(r.fund+': payment log missing');return;}var day=r.date.slice(0,10),matches=_mwPrValues_(sh).slice(8).filter(function(row){return _mwPrId_(row[1])===r.memberId&&typeof row[3]==='number'&&Math.round(row[3]*100)===Math.round(r.amount*100)&&row[0] instanceof Date&&Utilities.formatDate(row[0],tz,'yyyy-MM-dd')===day;});if(matches.length!==1)notes.push('PAYMENTS row '+r.row+': '+matches.length+' matching fund-log entries; inspect allocation history');}catch(err){notes.push('PAYMENTS row '+r.row+': '+err.message);}});item.integrityNotes=notes;if(notes.length&&item.auditStatus!=='MISSING / REVIEW'){item.auditStatus='REVIEW';item.finding+=' '+notes.join('; ');}if(item.auditStatus==='RECORDED CANDIDATES')stats.recorded++;else if(item.auditStatus==='MISSING / REVIEW')stats.missing++;else stats.review++;});scan.stats=stats;scan.completePage=true;scan.completePeriod=scan.nextOffset===null&&Number(scan.offset||0)===0;scan.message='Check complete for this page of up to 50 bank conversations. '+(scan.nextOffset!==null?'More conversations remain—check the next page. ':'')+'Missing/review results are action items, not automatic approval to record money. No payments, balances, labels or emails changed.';return scan;}
function _mwOpsZelleEmailPlan_(input){var scan=_mwOpsZelleCheck_({period:input.period,start:input.start,end:input.end,offset:input.offset}),flagged=scan.items.filter(function(m){return m.auditStatus!=='RECORDED CANDIDATES';}),cfg=getSettings(),title='Zelle check — '+scan.period.start+' through '+scan.period.end+' | page '+(Math.floor(scan.offset/50)+1),text=title+'\n'+scan.stats.missing+' missing/review sources; '+scan.stats.review+' other review items; '+scan.stats.recorded+' recorded candidates.\n'+scan.message,rows=[['Date','Sender','Amount','Memo','Finding','Ledger rows']].concat(flagged.map(function(m){return [m.date||'',m.sender||'',m.amount===undefined?'Unknown':'$'+m.amount.toFixed(2),m.memo||'',m.finding||m.error||'Needs review',(m.candidateRows||[]).map(function(r){return r.row;}).join(', ')];}));return {details:{email:{recipient:cfg.leaderEmail,subject:title,text:text,html:_mwActHtml_(title,text,rows)},zelleStats:scan.stats,scope:scan.message},snapshot:{period:scan.period,offset:scan.offset,nextOffset:scan.nextOffset,items:scan.items},summary:'Email this checked page’s '+flagged.length+' missing/review findings to '+cfg.leaderEmail+'. Recheck the page before sending. No automatic payment fixes or bank labels.'};}

// Alert count only: never build an executable cleanup plan or read sheet formulas.
function _mwOpsCleanupCount_(){var ss=_mwPrSS_(),active={},removed={},count=0;_mwPrValues_(ss.getSheetByName('MEMBERS')).forEach(function(r){var id=_mwPrId_(r[16]);if(id)active[id]=true;});['REMOVED_MEMBERS','REMOVED MEMBERS ARCHIVE'].forEach(function(name){var sh=ss.getSheetByName(name);if(!sh)return;var d=_mwPrValues_(sh),h=(d[0]||[]).map(_mwPrNormalize_),ic=h.indexOf('memberid'),dc=h.indexOf('removedat');if(ic<0||dc<0)throw Error(name+' needs Member ID and Removed At headers');d.slice(1).forEach(function(r){var id=_mwPrId_(r[ic]);if(id&&!active[id]&&r[dc]&&!isNaN(new Date(r[dc]).getTime()))removed[id]=true;});});if(!Object.keys(removed).length)return 0;ss.getSheets().forEach(function(sh){if(!/^TRACK-\d+$/i.test(sh.getName()))return;_mwPrValues_(sh).slice(7).forEach(function(r){if(removed[_mwPrId_(r[0])]&&!(Number(r[3])>0||Number(r[5])>0||/PAID|COVERED/i.test(String(r[7]))))count++;});});return count;}
