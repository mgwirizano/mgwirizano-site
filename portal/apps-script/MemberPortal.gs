/**
 * Install in a NEW standalone Apps Script project. Existing doGet stays intact.
 * All settings live in Script Properties; see SETUP.md. No credentials in GitHub.
 * Production finance writes are disabled until PORTAL_LEDGER_ENABLED=true.
 */
var MP_TABLES_={ACCOUNTS:'PORTAL ACCOUNTS',LEDGER:'PORTAL LEDGER',DOCUMENTS:'PORTAL DOCUMENTS',MESSAGES:'PORTAL MESSAGES',TICKETS:'PORTAL ENQUIRIES',AUDIT:'PORTAL AUDIT',READS:'PORTAL READ RECEIPTS'};
function mpConfig_(){
 var p=PropertiesService.getScriptProperties().getProperties();
 if(!p.PORTAL_SPREADSHEET_ID||!p.FIREBASE_PROJECT_ID||!p.FIREBASE_WEB_API_KEY)throw new Error('Portal setup is incomplete.');
 return {spreadsheetId:p.PORTAL_SPREADSHEET_ID,projectId:p.FIREBASE_PROJECT_ID,apiKey:p.FIREBASE_WEB_API_KEY,
 admins:String(p.PORTAL_ADMIN_EMAILS||'').toLowerCase().split(',').map(function(x){return x.trim();}).filter(Boolean),
 owner:String(p.PORTAL_OWNER_EMAIL||'').toLowerCase(),folderId:p.PORTAL_DOCUMENT_FOLDER_ID||'',ledgerEnabled:p.PORTAL_LEDGER_ENABLED==='true',
 autoApply:p.PORTAL_AUTO_APPLY_CREDIT==='true',ingestionSecret:p.PORTAL_INGESTION_SECRET||'',ingestionEnabled:p.PORTAL_INGESTION_ENABLED==='true'};
}
function doGet(){
 var cfg=mpConfig_(),template=HtmlService.createTemplateFromFile('MemberPortal');
 template.boot=JSON.stringify({mode:'live',apiKey:cfg.apiKey,projectId:cfg.projectId}).replace(/</g,'\\u003c');
 return template.evaluate().setTitle('Mgwirizano · Member Portal').addMetaTag('viewport','width=device-width, initial-scale=1');
}
function setupMemberPortal(){
 var cfg=mpConfig_(),email=String(Session.getActiveUser().getEmail()||'').toLowerCase();
 if(!cfg.owner||email!==cfg.owner)throw new Error('Run setup as the configured portal owner.');
 var ss=SpreadsheetApp.openById(cfg.spreadsheetId);
 if(!ss.getSheetByName('MEMBERS'))throw new Error('The selected spreadsheet has no MEMBERS sheet.');
 Object.keys(MP_TABLES_).forEach(function(key){var name=MP_TABLES_[key],sh=ss.getSheetByName(name);if(!sh){sh=ss.insertSheet(name);sh.appendRow(['Record ID','Recorded At','Record JSON']);sh.setFrozenRows(1);sh.getRange('A:C').setNumberFormat('@');}});
 Logger.log('Portal tables ready. Existing MEMBERS, PAYMENTS, FUNDS and TRACK sheets were not changed. Ledger enabled: '+cfg.ledgerEnabled);
}
function mpRows_(ss,key){var sh=ss.getSheetByName(MP_TABLES_[key]);if(!sh)throw new Error('Run setupMemberPortal first.');return sh.getDataRange().getValues().slice(1).filter(function(r){return r[0];}).map(function(r){return JSON.parse(String(r[2]));});}
function mpAppend_(ss,key,row){ss.getSheetByName(MP_TABLES_[key]).appendRow([row.id,row.at||row.date||new Date().toISOString(),JSON.stringify(row)]);}
function mpReplace_(ss,key,row){var sh=ss.getSheetByName(MP_TABLES_[key]),rs=sh.getDataRange().getValues();for(var i=1;i<rs.length;i++){if(String(rs[i][0])===row.id){sh.getRange(i+1,3).setValue(JSON.stringify(row));return;}}throw new Error('Record not found.');}
function mpLock_(fn){var l=LockService.getScriptLock();if(!l.tryLock(20000))throw new Error('Another update is in progress. Please try again.');try{return fn();}finally{l.releaseLock();}}
function mpId_(){return Utilities.getUuid();}
function mpAudit_(ss,actor,action){mpAppend_(ss,'AUDIT',{id:mpId_(),at:new Date().toISOString(),actor:actor,action:action});}
function mpText_(v,max,required){var s=String(v||'').trim();if(s.length>max||required&&!s)throw new Error('A required field is missing or too long.');return s;}
function mpMembers_(ss){
 return ss.getSheetByName('MEMBERS').getDataRange().getValues().slice(1).filter(function(r){return /^MW\d{4}$/.test(String(r[16]||'').trim().toUpperCase());}).map(function(r){return {id:String(r[16]).trim().toUpperCase(),name:String(r[2]||''),email:String(r[1]||'').trim().toLowerCase(),phone:String(r[3]||''),location:String(r[4]||''),joined:r[0] instanceof Date?r[0].toISOString():String(r[0]||'')};});
}
function mpVerify_(token,cfg){
 if(typeof token!=='string'||token.length>10000||token.split('.').length!==3)throw new Error('Please sign in again.');
 var claims;
 try{claims=JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(token.split('.')[1])).getDataAsString());}catch(e){throw new Error('Please sign in again.');}
 // Claims are only trusted after Firebase validates the token below.
 if(claims.aud!==cfg.projectId||claims.iss!=='https://securetoken.google.com/'+cfg.projectId||!claims.exp||claims.exp<=Math.floor(Date.now()/1000))throw new Error('Please sign in again.');
 var response=UrlFetchApp.fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key='+encodeURIComponent(cfg.apiKey),{method:'post',contentType:'application/json',payload:JSON.stringify({idToken:token}),muteHttpExceptions:true});
 if(response.getResponseCode()!==200)throw new Error('Please sign in again.');
 var user=JSON.parse(response.getContentText()).users;
 if(!user||user.length!==1||user[0].localId!==claims.sub||user[0].disabled||!user[0].emailVerified)throw new Error('Verify your email address before accessing your account.');
 if(user[0].validSince&&Number(claims.auth_time)<Number(user[0].validSince))throw new Error('Your session has expired. Please sign in again.');
 return {uid:user[0].localId,email:String(user[0].email||'').toLowerCase()};
}
function mpActor_(ss,cfg,verified){
 var members=mpMembers_(ss),matches=members.filter(function(m){return m.email===verified.email;});
 if(matches.length!==1)throw new Error('Your verified email needs to be linked to one membership record. Contact leadership.');
 var member=matches[0];if(members.filter(function(m){return m.id===member.id;}).length!==1)throw new Error('Membership record requires review.');
 var accounts=mpRows_(ss,'ACCOUNTS'),account=accounts.find(function(a){return a.uid===verified.uid;});
 if(account&&(account.memberId!==member.id||account.email!==verified.email))throw new Error('Account details need verification by leadership.');
 if(!account){
   account=mpLock_(function(){var current=mpRows_(ss,'ACCOUNTS');var existing=current.find(function(a){return a.uid===verified.uid;});if(existing)return existing;
     if(current.some(function(a){return a.memberId===member.id;}))throw new Error('An account is already linked to this member. Contact leadership.');
     var a={id:mpId_(),uid:verified.uid,memberId:member.id,email:verified.email,status:'ACTIVE',at:new Date().toISOString()};mpAppend_(ss,'ACCOUNTS',a);mpAudit_(ss,verified.email,'Account activated · '+member.id);return a;});
 }
 if(account.status!=='ACTIVE')throw new Error('Portal access is suspended. Contact leadership.');
 return {uid:verified.uid,email:verified.email,member:member,isAdmin:cfg.admins.indexOf(verified.email)>=0,account:account};
}
function mpAdmin_(actor){if(!actor.isAdmin)throw new Error('Administrator access required.');}
function mpVisible_(row,actor){return row.audience==='members'||row.audience===actor.member.id||row.audience==='board'&&actor.isAdmin;}
function mpHistory_(ss,memberId){
 var sh=ss.getSheetByName('PAYMENTS');if(!sh)return [];
 return sh.getDataRange().getValues().slice(1).filter(function(r){return String(r[1]||'').trim().toUpperCase()===memberId;}).map(function(r){return {date:r[0] instanceof Date?Utilities.formatDate(r[0],ss.getSpreadsheetTimeZone(),'MMM d, yyyy'):String(r[0]||''),amount:Math.round((Number(r[3])||0)*100),type:String(r[4]||''),fund:String(r[6]||''),status:String(r[10]||'')};}).reverse();
}
function mpDashboard_(ss,cfg,actor){
 var events=mpRows_(ss,'LEDGER'),docs=mpRows_(ss,'DOCUMENTS'),messages=mpRows_(ss,'MESSAGES'),tickets=mpRows_(ss,'TICKETS'),reads=mpRows_(ss,'READS');
 var safeDoc=function(d){return {id:d.id,title:d.title,category:d.category,period:d.period,date:d.date,audience:d.audience};};
 var result={member:actor.member,ledger:MWLedger.state(events,actor.member.id),ledgerEnabled:cfg.ledgerEnabled,history:mpHistory_(ss,actor.member.id),canAdmin:actor.isAdmin,mode:'live',
 documents:docs.filter(function(d){return mpVisible_(d,actor);}).map(safeDoc),messages:messages.filter(function(m){return mpVisible_(m,actor);}).map(function(m){return Object.assign({},m,{read:reads.some(function(r){return r.memberId===actor.member.id&&r.messageId===m.id;})});}),tickets:tickets.filter(function(t){return t.memberId===actor.member.id;})};
 if(actor.isAdmin){var accounts=mpRows_(ss,'ACCOUNTS');result.admin={members:mpMembers_(ss).map(function(m){var a=accounts.find(function(a){return a.memberId===m.id;});return Object.assign({},m,{status:a?a.status:'NOT ACTIVATED'},MWLedger.state(events,m.id));}),events:events,documents:docs.map(safeDoc),messages:messages,tickets:tickets,audit:mpRows_(ss,'AUDIT').slice(-200).reverse()};}
 return result;
}
function portalRpc(request){
 try{
  if(!request||typeof request!=='object')throw new Error('Invalid request.');
  var cfg=mpConfig_(),verified=mpVerify_(request.token,cfg),ss=SpreadsheetApp.openById(cfg.spreadsheetId),actor=mpActor_(ss,cfg,verified),p=request.payload||{},action=String(request.action||'');
  if(action==='dashboard')return {ok:true,data:mpDashboard_(ss,cfg,actor)};
  if(action==='document'){
    var doc=mpRows_(ss,'DOCUMENTS').find(function(d){return d.id===p.id;});if(!doc||!mpVisible_(doc,actor))throw new Error('Document unavailable.');
    var file=mpPrivatePdf_(doc.fileId,cfg);mpAudit_(ss,actor.email,'Document accessed · '+doc.title);
    return {ok:true,data:{name:file.getName(),base64:Utilities.base64Encode(file.getBlob().getBytes())}};
  }
  var result=mpLock_(function(){
   // Recheck suspension after obtaining the mutation lock.
   var fresh=mpRows_(ss,'ACCOUNTS').find(function(a){return a.uid===actor.uid;});if(!fresh||fresh.status!=='ACTIVE')throw new Error('Portal access is suspended.');
   if(action==='ledger'){
     mpAdmin_(actor);if(!cfg.ledgerEnabled)throw new Error('Ledger posting is disabled until opening balances are reconciled.');
     if(mpMembers_(ss).filter(function(m){return m.id===p.memberId;}).length!==1)throw new Error('Select one current member.');
     p.autoApply=cfg.autoApply;
     var e=MWLedger.create(mpRows_(ss,'LEDGER'),p,actor.email,new Date().toISOString(),mpId_());if(!e.duplicate)mpAppend_(ss,'LEDGER',e.event);return e;
   }
   if(action==='accountStatus'){
     mpAdmin_(actor);if(['ACTIVE','SUSPENDED'].indexOf(p.status)<0)throw new Error('Invalid account status.');
     var account=mpRows_(ss,'ACCOUNTS').find(function(a){return a.memberId===p.memberId;});if(!account)throw new Error('The member has not activated an account.');
     if(account.uid===actor.uid)throw new Error('You cannot suspend your own administrator account.');
     var old=account.status;account.status=p.status;mpReplace_(ss,'ACCOUNTS',account);mpAudit_(ss,actor.email,'Account '+p.memberId+': '+old+' → '+p.status);return {ok:true};
   }
   if(action==='resetPassword'){
     mpAdmin_(actor);var target=mpMembers_(ss).filter(function(m){return m.id===p.memberId;});if(target.length!==1)throw new Error('Member record requires review.');
     var response=UrlFetchApp.fetch('https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key='+encodeURIComponent(cfg.apiKey),{method:'post',contentType:'application/json',payload:JSON.stringify({requestType:'PASSWORD_RESET',email:target[0].email}),muteHttpExceptions:true});
     if(response.getResponseCode()!==200)throw new Error('Reset could not be requested. Check account activation or try later.');
     mpAudit_(ss,actor.email,'Password reset requested · '+p.memberId);return {message:'Password-reset instructions requested for the registered email.'};
   }
   if(action==='acknowledge'){
     var message=mpRows_(ss,'MESSAGES').find(function(m){return m.id===p.id;});if(!message||!mpVisible_(message,actor))throw new Error('Message unavailable.');
     if(!mpRows_(ss,'READS').some(function(r){return r.memberId===actor.member.id&&r.messageId===p.id;}))mpAppend_(ss,'READS',{id:mpId_(),at:new Date().toISOString(),memberId:actor.member.id,messageId:p.id});return {ok:true};
   }
   if(action==='ticket'||action==='profileRequest'){
     var t={id:mpId_(),date:new Date().toISOString(),memberId:actor.member.id,status:'OPEN',reply:''};
     if(action==='ticket'){t.subject=mpText_(p.subject,120,true);t.body=mpText_(p.body,3000,true);}
     else{t.subject='Profile update request';t.body='Phone: '+mpText_(p.phone,40,false)+'\nLocation: '+mpText_(p.location,100,false);}
     var recent=mpRows_(ss,'TICKETS').filter(function(x){return x.memberId===actor.member.id&&new Date(x.date).getTime()>Date.now()-3600000;});if(recent.length>=5)throw new Error('Please wait before submitting another enquiry.');
     mpAppend_(ss,'TICKETS',t);return {ok:true};
   }
   if(action==='reply'){
     mpAdmin_(actor);var ticket=mpRows_(ss,'TICKETS').find(function(t){return t.id===p.id;});if(!ticket)throw new Error('Enquiry not found.');
     ticket.reply=mpText_(p.reply,3000,true);ticket.status='REPLIED';ticket.repliedAt=new Date().toISOString();ticket.repliedBy=actor.email;mpReplace_(ss,'TICKETS',ticket);mpAudit_(ss,actor.email,'Reply saved · '+ticket.id);return {ok:true};
   }
   if(action==='publish'){
     mpAdmin_(actor);if(['members','board'].indexOf(p.audience)<0)throw new Error('Choose a valid audience.');
     var item={id:mpId_(),date:new Date().toISOString(),title:mpText_(p.title,150,true),audience:p.audience,author:'Leadership'};
     if(p.type==='document'){item.fileId=mpText_(p.fileId,160,true);mpPrivatePdf_(item.fileId,cfg);item.category=mpText_(p.category,60,true);item.period=mpText_(p.period,60,true);mpAppend_(ss,'DOCUMENTS',item);}
     else if(p.type==='message'){item.body=mpText_(p.body,5000,true);mpAppend_(ss,'MESSAGES',item);}else throw new Error('Invalid publication type.');
     mpAudit_(ss,actor.email,'Published '+p.type+' · '+item.title);return {ok:true};
   }
   throw new Error('Unsupported request.');
  });
  return {ok:true,data:result};
 }catch(e){return {ok:false,error:String(e.message||'Request failed.').slice(0,250)};}
}
function mpPrivatePdf_(id,cfg){
 if(!cfg.folderId)throw new Error('An approved private document folder must be configured.');
 if(!/^[A-Za-z0-9_-]{10,160}$/.test(id))throw new Error('Invalid document ID.');
 var file=DriveApp.getFileById(id);if(file.isTrashed()||file.getMimeType()!=='application/pdf'||file.getSize()>5*1024*1024)throw new Error('Use a PDF no larger than 5 MB.');
 if(file.getSharingAccess()!==DriveApp.Access.PRIVATE)throw new Error('Set the document’s general access to Restricted before publishing.');
 var parents=file.getParents(),approved=false;while(parents.hasNext()){if(parents.next().getId()===cfg.folderId)approved=true;}if(!approved)throw new Error('Document must be in the approved private folder.');
 return file;
}
/** Optional payment bridge: disabled unless explicitly configured after cutover. */
function doPost(e){
 var reply;
 try{
   var cfg=mpConfig_();if(!cfg.ledgerEnabled||!cfg.ingestionEnabled||cfg.ingestionSecret.length<32)throw new Error('Payment bridge is disabled.');
   var raw=e&&e.postData&&e.postData.contents||'';if(raw.length>16000)throw new Error('Invalid request.');var envelope=JSON.parse(raw);
   if(!Number.isFinite(envelope.timestamp)||Math.abs(Date.now()-envelope.timestamp)>300000||typeof envelope.payload!=='string')throw new Error('Expired request.');
   var expected=Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(envelope.timestamp+'.'+envelope.payload,cfg.ingestionSecret));
   if(!mpEqual_(expected,String(envelope.signature||'')))throw new Error('Invalid signature.');
   var p=JSON.parse(envelope.payload);if(p.kind!=='PAYMENT')throw new Error('Only confirmed payments are accepted.');
   var ss=SpreadsheetApp.openById(cfg.spreadsheetId);
   reply=mpLock_(function(){if(mpMembers_(ss).filter(function(m){return m.id===p.memberId;}).length!==1)throw new Error('Member requires review.');var r=MWLedger.create(mpRows_(ss,'LEDGER'),p,'Verified payment bridge',new Date().toISOString(),mpId_());if(!r.duplicate)mpAppend_(ss,'LEDGER',r.event);return {ok:true,duplicate:r.duplicate,receipt:r.event.id};});
 }catch(err){reply={ok:false,error:'Payment not posted. Review bridge configuration, matching and reference.'};}
 return ContentService.createTextOutput(JSON.stringify(reply)).setMimeType(ContentService.MimeType.JSON);
}
function mpEqual_(a,b){if(a.length!==b.length)return false;var diff=0;for(var i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;}
