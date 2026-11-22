// Optional dashboard operations. Never run scanner/reconciliation or send notices on page load.
function _mwOpsRoute_(p,actor){
  MWPR_READ_CACHE={};MWPR_SS=null;
  if(p.action==='fp_ops_mail')return _mwOpsMailQueue_(p);
  if(p.action==='fp_ops_stage_preview')return _mwOpsStagePreview_(p);
  if(p.action==='fp_ops_stage_apply')return _mwOpsStageApply_(p);
  if(p.action==='fp_ops_notices')return _mwOpsNoticeList_();
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
function _mwOpsNoticeList_(){
  var ss=_mwPrSS_(),funds=_mwFpFunds_(),ledger=_mwPrLedger_(),today=Utilities.formatDate(new Date(),'America/Los_Angeles','yyyy-MM-dd'),index=_mwOpsReviewIndex_(),potential={},members={},warnings=[];
  _mwPrValues_(ss.getSheetByName('MEMBERS')).forEach(function(r){var id=_mwPrId_(r[16]);if(id)members[id]={id:id,name:_mwPrText_(r[2]),email:_mwPrText_(r[1])};});
  var overdue=funds.filter(function(f){return /^\d{4}-\d{2}-\d{2}$/.test(f.deadline)&&f.deadline<today;});
  overdue.forEach(function(f){var sh=ss.getSheetByName('TRACK-'+f.code.slice(-3));if(!sh){warnings.push(f.code+': tracker missing');return;}
    var trackRows=_mwPrValues_(sh);if(typeof _terminationIncludeApprovedTrackGaps_==='function')trackRows=_terminationIncludeApprovedTrackGaps_(trackRows,f.code,members);
    trackRows.slice(7).forEach(function(r){var id=_mwPrId_(r[0]);if(!members[id]||/^(PAID|EXEMPT)|COVERED/i.test(String(r[7]))||/^HOLD/i.test(String(r[8]))||(Number(r[4])<=0&&!/ADMIN-REVIEWED TRACK GAP/.test(String(r[8]))))return;(potential[id]||(potential[id]=[])).push(f.code);});});
  var recipients=[];
  Object.keys(potential).filter(function(id){return potential[id].length>=5;}).forEach(function(id){var m=members[id],obligations=[],issues=[];
    potential[id].forEach(function(code){var o=_mwPrObligation_(id,code,ledger);if(o.status==='EXEMPT'||o.balance===0)return;if(o.status==='REVIEW'||o.balance===null)issues.push(code+': '+o.issues.join('; '));obligations.push(o);});
    if(obligations.length<5)return;var prior=index[id]||{decision:'HOLD',sendStatus:''};
    var blocked=issues.slice();if(!/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(m.email))blocked.push('Member email missing or invalid');if(['EXCLUDE','RESOLVED'].indexOf(prior.decision)>=0)blocked.push('Existing review decision '+prior.decision);if(prior.sendStatus==='SENT')blocked.push('Warning already sent; original history retained');
    recipients.push({memberId:id,name:m.name,email:m.email,missed:obligations.length,total:Math.round(obligations.reduce(function(a,o){return a+Number(o.balance||0);},0)*100)/100,obligations:obligations,decision:prior.decision,sendStatus:prior.sendStatus,issues:issues,blocked:blocked,canSend:!blocked.length,review:prior});
  });
  recipients.sort(function(a,b){return b.missed-a.missed||a.name.localeCompare(b.name);});
  return {status:'ok',minimumMissedFunds:5,members:recipients,warnings:warnings,message:'Read-only review: five or more overdue funds. Exemptions, existing exclusions and previously sent warnings are protected. No membership removals are performed.'};
}
function _mwOpsNoticePlan_(p){
  var ids=p.memberIds;if(!Array.isArray(ids)||!ids.length||ids.length>10||ids.some(function(id,i){return !_mwPrId_(id)||ids.indexOf(id)!==i;}))throw Error('Select 1–10 distinct members');
  if(typeof _buildTerminationNoticeEmail!=='function')throw Error('Existing termination notice email builder is missing; add your existing notice script unchanged.');
  var cfg=getSettings(),noticeDays=7,today=Utilities.formatDate(new Date(),'America/Los_Angeles','yyyy-MM-dd'),deadline=String(p.deadline||'');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(deadline)||isNaN(new Date(deadline+'T12:00:00Z').getTime())||new Date(deadline+'T12:00:00Z').toISOString().slice(0,10)!==deadline)throw Error('Choose a valid warning deadline');
  var min=new Date(today+'T12:00:00Z');min.setUTCDate(min.getUTCDate()+noticeDays);if(deadline<min.toISOString().slice(0,10))throw Error('Allow at least seven calendar days for the warning deadline');
  var list=_mwOpsNoticeList_(),selected=ids.map(function(id){var m=list.members.filter(function(x){return x.memberId===id;})[0];if(!m||!m.canSend)throw Error(id+': '+(m?m.blocked.join('; '):'no longer qualifies'));return m;});
  var messages=selected.map(function(m){var member={id:m.memberId,name:m.name,email:m.email,total:m.total,funds:m.obligations.map(function(o){return {code:o.fundCode,deceased:o.deceased,closed:o.deadline,amount:o.balance,contribution:Math.max(0,o.balance-o.lateFee),lateFee:o.lateFee,memo:m.memberId+' '+o.fundCode,lastName:(o.deceased||'').split(/\s+/).pop()};})};return {member:member,message:_buildTerminationNoticeEmail(cfg,member,deadline,noticeDays),review:m.review};});
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
        if(item.review.row){review.getRange(item.review.row,1).setValues([['PROCEED']]);review.getRange(item.review.row,8).setValues([[plan.deadline]]);review.getRange(item.review.row,11,1,2).setValues([['SENT',new Date()]]);}
        else review.getRange(review.getLastRow()+1,1,1,12).setValues([['PROCEED',item.member.id,item.member.name,item.member.email,item.member.funds.length,item.member.funds.map(function(f){return f.code;}).join(', '),item.member.total,plan.deadline,'Selected and confirmed on dashboard',new Date(),'SENT',new Date()]]);
        results.push({memberId:item.member.id,status:'SENT'});
      }catch(err){audit.getRange(row,4).setValues([['UNCERTAIN']]);audit.getRange(row,7).setValues([[String(err.message)]]);results.push({memberId:item.member.id,status:'UNCERTAIN',message:'Delivery may have occurred. Inspect audit and sent mail; no automatic resend.'});}
    });return {status:'ok',results:results,message:'Selected warning run finished. Memberships were not removed.'};
  }finally{lock.releaseLock();}
}
