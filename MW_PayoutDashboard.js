/* Add after the dashboard main script. No existing login credentials are copied here. */
const FP_PANEL_HTML="<section class=\"card fp-panel\" id=\"sec-family-payouts\">\n  <div class=\"card-header\"><span class=\"card-title\">Family fund balance &amp; payments</span></div>\n  <div class=\"fp-body\">\n    <p>Select any active or closed fund to see its recorded family share and payments already sent.</p>\n    <label for=\"fp-fund\">Fund</label>\n    <select id=\"fp-fund\" onchange=\"fpLoadBalance()\"><option value=\"\">Loading funds\u2026</option></select>\n    <div class=\"fp-actions\"><button class=\"hero-btn secondary\" onclick=\"fpLoadBalance()\" type=\"button\">Refresh balance</button><button class=\"hero-btn primary\" type=\"button\" onclick=\"fpPrintReport()\">Print / save PDF report</button></div>\n    <div id=\"fp-status\" role=\"status\" aria-live=\"polite\"></div>\n    <div id=\"fp-summary\"></div>\n    <details><summary>Record a payment already sent</summary>\n      <p>This records a bank payment in PAYOUTS. It does not send money. Add missing historical payments here before relying on the remaining balance.</p>\n      <form id=\"fp-form\" onsubmit=\"event.preventDefault();fpPreviewPayment()\" oninput=\"fpInvalidate()\" onchange=\"fpInvalidate()\">\n        <div class=\"fp-fields\">\n          <div><label for=\"fp-type\">Payment category</label><select id=\"fp-type\"><option value=\"FAMILY\">Family payout / advance</option><option value=\"REFUND\">Refund</option><option value=\"EXPENSE\">Organization expense</option><option value=\"OTHER\">Other outgoing payment</option></select></div>\n          <div><label for=\"fp-date\">Actual payment date</label><input id=\"fp-date\" type=\"date\" required></div>\n          <div><label for=\"fp-amount\">Amount ($)</label><input id=\"fp-amount\" type=\"number\" min=\"0.01\" max=\"1000000\" step=\"0.01\" required placeholder=\"1500.00\"></div>\n          <div><label for=\"fp-receiver\">Receiver</label><input id=\"fp-receiver\" maxlength=\"500\" required autocomplete=\"off\"></div>\n          <div><label for=\"fp-platform\">Platform / paying account</label><input id=\"fp-platform\" maxlength=\"500\" required placeholder=\"Zelle from Chase\"></div>\n          <div><label for=\"fp-reference\">Bank confirmation / reference</label><input id=\"fp-reference\" maxlength=\"500\" required autocomplete=\"off\"></div>\n        </div>\n        <label for=\"fp-description\">Description</label><input id=\"fp-description\" maxlength=\"500\" required placeholder=\"$1,500 advance to the family\">\n        <label for=\"fp-notes\">Notes (optional)</label><input id=\"fp-notes\" maxlength=\"500\">\n        <p>For a non-family payment, choose its related fund above or \u201cNo fund / organization payment.\u201d</p>\n        <label style=\"display:flex;gap:10px;align-items:flex-start\"><input id=\"fp-reserveAdvance\" type=\"checkbox\" style=\"width:20px;min-height:20px;margin-top:4px\">This is an authorized family advance from reserves, even if it exceeds the currently recorded family share.</label>\n        <div class=\"fp-actions\"><button class=\"hero-btn secondary\" id=\"fp-preview-btn\" type=\"submit\">Preview only</button><button class=\"hero-btn primary\" id=\"fp-save-btn\" type=\"button\" disabled onclick=\"fpSavePayment()\">Confirm and record payment</button><button class=\"hero-btn secondary\" type=\"button\" onclick=\"fpResetPayment()\">New payment</button></div>\n      </form>\n      <div id=\"fp-preview\" role=\"status\" aria-live=\"polite\"></div>\n    </details>\n  </div>\n</section>\n";
const FP_PANEL_CSS=".fp-panel{margin-bottom:20px;scroll-margin-top:100px}.fp-body{padding:20px;font-size:16px;line-height:1.6}.fp-body p{color:var(--text2);margin:0 0 14px}.fp-body label{display:block;font-size:14px;font-weight:600;margin:12px 0 5px}.fp-body input,.fp-body select{width:100%;min-height:44px;padding:10px 12px;background:var(--card2);color:var(--text);border:1px solid #52708c;border-radius:8px;font:inherit;max-width:100%}.fp-body input:focus,.fp-body select:focus{outline:2px solid var(--gmid);outline-offset:2px}.fp-fields{display:grid;grid-template-columns:1fr 1fr;gap:0 18px}.fp-actions{display:flex;gap:10px;flex-wrap:wrap;margin:16px 0}.fp-body button{min-height:44px;font-size:14px}.fp-body button:disabled{opacity:.45;cursor:not-allowed}.fp-body details{border-top:1px solid var(--border);margin-top:20px;padding-top:16px}.fp-body summary{font-weight:700;cursor:pointer}.fp-metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:16px 0}.fp-metric{background:var(--card2);padding:14px;border-radius:8px}.fp-metric span{display:block;font-size:14px;color:var(--text2)}.fp-metric strong{font-size:22px;color:var(--gmid)}.fp-note{background:rgba(214,139,12,.12);padding:12px;border-radius:8px;margin:12px 0;color:#f5d48a}.fp-table-wrap{overflow-x:auto}.fp-body table{width:100%;border-collapse:collapse;font-size:14px}.fp-body th,.fp-body td{text-align:left;border-bottom:1px solid var(--border);padding:10px;vertical-align:top}.fp-error{color:#ffb5b5;padding:10px 0}#fp-status{white-space:pre-wrap}#fp-signin{margin-bottom:10px}@media(max-width:760px){.fp-metrics{grid-template-columns:1fr 1fr}.fp-fields{grid-template-columns:1fr}.fp-body{padding:14px}.fp-actions button{flex:1 1 160px}}\n";
// No additional Google sign-in or PIN is required by this add-on.
// Financial changes retain dry-run preview, explicit confirmation and receipt checks.
let fpFundDetails = [], fpSummary = null, fpPreview = null, fpRequestId = '', fpBusy = false;
function fpEscape(v){return String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function fpMoney(v){return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(v)||0);}
function fpStatus(message,error){const el=document.getElementById('fp-status');if(el){el.textContent=message;el.className=error?'fp-error':'';}}
function fpInvalidate(){fpPreview=null;const b=document.getElementById('fp-save-btn');if(b)b.disabled=true;const el=document.getElementById('fp-preview');if(el)el.textContent='';}
async function fpCall(action,params={}){
  const response=await fetch(SCRIPT_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify({...params,action}),redirect:'follow'});
  const data=await response.json();
  if(data.status!=='ok')throw Error(data.message||'Could not reach the payout service.');
  if(action==='fp_funds'&&!Array.isArray(data.funds))throw Error('Install the payout backend and POST dispatch line, then redeploy Apps Script.');
  return data;
}
async function fpLoadFunds(){
  if(fpBusy)return;fpBusy=true;ftBusy=true;fpStatus('Loading funds…');
  try{
    const d=await fpCall('fp_funds'),sel=document.getElementById('fp-fund'),current=sel.value;
    sel.replaceChildren(new Option('No fund / organization payment',''));
    fpFundDetails=d.funds;fpDecorateFundCards();
    d.funds.forEach(f=>sel.add(new Option(`${f.code} — ${f.deceased} (${f.status})`,f.code)));
    if(current)sel.value=current;
    fpStatus('Select a fund to view its balance. No records changed.');
  }catch(e){fpStatus(e.message,true);}finally{fpBusy=false;ftBusy=false;}
}
async function fpLoadBalance(){
  fpInvalidate();fpSummary=null;
  const code=document.getElementById('fp-fund').value;
  document.getElementById('fp-summary').replaceChildren();
  if(!code){fpStatus('Select a fund for its balance; organization payments can be recorded without one.');return;}
  if(fpBusy)return;fpBusy=true;ftBusy=true;fpStatus('Reading recorded balances and payout history…');
  try{fpSummary=await fpCall('fp_balance',{fundCode:code});fpRender();fpStatus('Read-only balance loaded. No records changed.');}
  catch(e){fpStatus(e.message,true);}finally{fpBusy=false;ftBusy=false;}
}
function fpRender(){
  const d=fpSummary,el=document.getElementById('fp-summary');if(!d||!el)return;
  const metrics=[['Core contribution base',d.coreBase],['Admin fee (5%)',d.adminFee],['Family share',d.familyShare],['Family payments recorded',d.familyPaid],['Remaining family share',d.remaining],['Other outgoing payments',d.otherOutgoings],['Tracker paid amounts',d.recordedCollected]];
  el.innerHTML='<div class="fp-metrics">'+metrics.map(([l,v])=>'<div class="fp-metric"><span>'+fpEscape(l)+'<\/span><strong>'+fpMoney(v)+'<\/strong><\/div>').join('')+'<\/div>'+
    '<p>'+d.fullCount+' fully paid / credit-covered; '+d.partialCount+' partial; '+d.pendingCount+' pending; '+d.excludedCount+' exempt. Credit-covered: '+d.creditCount+'.<\/p>'+
    '<div class="fp-note">'+fpEscape(d.method)+' Missing payouts will overstate the remaining share.'+(d.overpaid?' Recorded payouts exceed this calculated share by '+fpMoney(d.overpaid)+'.':'')+'<\/div>'+
    '<details><summary>Calculation notes ('+d.warnings.length+')<\/summary><ul>'+d.warnings.map(w=>'<li>'+fpEscape(w)+'<\/li>').join('')+'<\/ul><\/details>'+
    '<h3 style="margin:16px 0 8px;font-size:16px">Recorded outgoing payments<\/h3><div class="fp-table-wrap"><table><thead><tr><th>Date<\/th><th>Type<\/th><th>Receiver<\/th><th>Description<\/th><th>Amount<\/th><\/tr><\/thead><tbody>'+d.payouts.map(p=>'<tr><td>'+fpEscape(p.date)+'<\/td><td>'+fpEscape(p.type)+'<\/td><td>'+fpEscape(p.receiver)+'<\/td><td>'+fpEscape(p.description)+'<\/td><td>'+fpMoney(p.amount)+'<\/td><\/tr>').join('')+'<\/tbody><\/table><\/div>';
}
function fpPayload(){
  if(!fpRequestId)fpRequestId=crypto.randomUUID();
  const p={requestId:fpRequestId,fundCode:document.getElementById('fp-fund').value,reserveAdvance:document.getElementById('fp-reserveAdvance').checked?'YES':'NO'};
  ['type','date','amount','receiver','platform','reference','description','notes'].forEach(k=>p[k]=document.getElementById('fp-'+k).value.trim());
  return p;
}
async function fpPreviewPayment(){
  if(fpBusy)return;fpBusy=true;ftBusy=true;fpInvalidate();fpStatus('Previewing only…');
  const btn=document.getElementById('fp-preview-btn');btn.disabled=true;
  try{
    const payload=fpPayload(),data=await fpCall('fp_preview',payload);
    fpPreview={payload,data};
    document.getElementById('fp-preview').textContent=data.message+' '+fpMoney(data.payment.amount)+' to '+data.payment.receiver+' on '+data.payment.date+'. Category: '+data.payment.type+'.'+(data.remainingAfter!==null?' Remaining family share after recording: '+fpMoney(data.remainingAfter)+'.':'');
    document.getElementById('fp-save-btn').disabled=!data.canSave||data.alreadyRecorded;
    fpStatus('Preview complete. Nothing saved.');
  }catch(e){fpStatus(e.message,true);}finally{btn.disabled=false;fpBusy=false;ftBusy=false;}
}
async function fpSavePayment(){
  if(fpBusy||!fpPreview)return;
  if(JSON.stringify(fpPayload())!==JSON.stringify(fpPreview.payload)){fpInvalidate();fpStatus('Form changed. Preview again.',true);return;}
  if(!confirm('Record this already-sent payment in PAYOUTS? '+fpMoney(fpPreview.payload.amount)+' to '+fpPreview.payload.receiver+'. This does not transfer money.'))return;
  const preview=fpPreview;fpBusy=true;ftBusy=true;document.getElementById('fp-save-btn').disabled=true;fpStatus('Recording payment. Keep this page open…');
  try{
    const d=await fpCall('fp_save',{...preview.payload,previewToken:preview.data.previewToken,confirmed:'YES'});
    fpStatus(d.message);fpPreview=null;document.getElementById('fp-preview').textContent='Saved. PAYOUTS row '+d.row+'. Start “New payment” for another transaction.';
    if(d.summary){fpSummary=d.summary;fpRender();}
    document.getElementById('fp-preview-btn').disabled=true;
  }catch(e){fpStatus(e.message+' If the connection failed, keep the same request and retry; do not start a new payment.',true);document.getElementById('fp-save-btn').disabled=false;}
  finally{fpBusy=false;ftBusy=false;}
}
function fpResetPayment(){if(fpBusy)return;document.getElementById('fp-form').reset();fpRequestId=crypto.randomUUID();fpInvalidate();document.getElementById('fp-preview-btn').disabled=false;fpStatus('New payment form ready.');}
function fpPrintReport(){
  if(!fpSummary){fpStatus('Load a fund balance first.',true);return;}
  const d=fpSummary,w=window.open('','_blank');if(!w){fpStatus('Allow a new window to print the report.',true);return;}
  const metrics=[['Core contribution base',d.coreBase],['Administration (5%)',-d.adminFee],['Family share',d.familyShare],['Family payments recorded',-d.familyPaid],['Remaining family share',d.remaining],['Other outgoing payments (excluded from family payouts)',d.otherOutgoings]];
  w.document.write('<!doctype html><html><head><title>'+fpEscape(d.fund.code)+' Family Fund Report<\/title><style>body{font:12pt Arial,sans-serif;color:#14263b;margin:32px;line-height:1.5}h1{font-size:20pt}table{width:100%;border-collapse:collapse;margin:16px 0}td,th{padding:8px;text-align:left;border-bottom:1px solid #bbc8d2}tr{break-inside:avoid}thead{display:table-header-group}th{background:#eaf5ed}li{margin-bottom:5px}@media print{button{display:none}@page{margin:16mm}}<\/style><\/head><body><button onclick="window.print()">Print / save PDF<\/button><h1>Mgwirizano Watsopano<\/h1><h2>'+fpEscape(d.fund.code)+' — '+fpEscape(d.fund.deceased)+'<\/h2><p>Recorded family fund report | As of '+fpEscape(d.calculatedAt)+'<\/p><table><tbody>'+metrics.map(([l,v])=>'<tr><th>'+fpEscape(l)+'<\/th><td>'+fpMoney(v)+'<\/td><\/tr>').join('')+'<\/tbody><\/table><p>'+fpEscape(d.method)+'<\/p><p><strong>Enter all missing historical payouts before relying on the remaining share. This report is not a bank reconciliation.<\/strong><\/p><h2>Payout history<\/h2><table><thead><tr><th>Date<\/th><th>Type<\/th><th>Receiver<\/th><th>Description<\/th><th>Amount<\/th><\/tr><\/thead><tbody>'+d.payouts.map(p=>'<tr><td>'+fpEscape(p.date)+'<\/td><td>'+fpEscape(p.type)+'<\/td><td>'+fpEscape(p.receiver)+'<\/td><td>'+fpEscape(p.description)+'<\/td><td>'+fpMoney(p.amount)+'<\/td><\/tr>').join('')+'<\/tbody><\/table><h2>Calculation notes<\/h2><ul>'+d.warnings.map(n=>'<li>'+fpEscape(n)+'<\/li>').join('')+'<\/ul><h2>Member contribution breakdown<\/h2><table><thead><tr><th>Member<\/th><th>Name<\/th><th>Status<\/th><th>Recorded paid<\/th><th>Core share<\/th><\/tr><\/thead><tbody>'+d.roster.map(r=>'<tr><td>'+fpEscape(r.memberId)+'<\/td><td>'+fpEscape(r.name)+'<\/td><td>'+fpEscape(r.status)+'<\/td><td>'+fpMoney(r.recordedPaid)+'<\/td><td>'+fpMoney(r.baseShare)+'<\/td><\/tr>').join('')+'<\/tbody><\/table><\/body><\/html>');w.document.close();
}

// Mount only inside the existing leadership dashboard, after its data renders.
// Enrich existing fund cards without replacing their totals or controls.
function fpDecorateFundCards(){
  document.querySelectorAll('#sec-funds .fund-item').forEach(card=>{
    const title=card.querySelector('.fund-name'),code=title?.textContent.match(/FUND-\d{3}/)?.[0];
    const fund=fpFundDetails.find(f=>f.code===code);if(!fund)return;
    let detail=card.querySelector('.fp-fund-details');
    if(!detail){detail=document.createElement('div');detail.className='fp-fund-details';detail.style.cssText='font-size:13px;color:var(--text2);margin:6px 0 10px;line-height:1.6';title.after(detail);}
    const text='Due date: '+(fund.deadline||'Not recorded')+' · Claiming member: '+(fund.beneficiaryName||'Name not recorded')+(fund.bereaved?' ('+fund.bereaved+')':'');
    if(detail.textContent!==text)detail.textContent=text;
  });
}
(function mountPayoutSection(){
  const style=document.createElement('style');style.textContent=FP_PANEL_CSS;document.head.appendChild(style);
  const previousBusy=isFixToolBusy;
  isFixToolBusy=function(){
    const panel=document.getElementById('sec-family-payouts');
    return fpBusy || !!fpPreview || !!(panel && panel.contains(document.activeElement)) ||
      !!(panel && Array.from(panel.querySelectorAll('input')).some(x=>x.type!=='checkbox' && x.value)) || previousBusy();
  };
  function mount(){
    fpDecorateFundCards();
    if(document.getElementById('sec-family-payouts'))return;
    const target=document.querySelector('#main-content .two-col');
    if(target){target.insertAdjacentHTML('beforebegin',FP_PANEL_HTML);fpLoadFunds();}
  }
  new MutationObserver(mount).observe(document.getElementById('main-content'),{childList:true,subtree:true});
  mount();
})();
