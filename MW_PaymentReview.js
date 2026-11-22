/* Load after MW_PayoutDashboard.js. Uses the existing dashboard; no extra login or PIN. */
let prFeed=null,prOffset=0,prBusy=false,prProfile=null,prAction=null,prPreview=null,prProfileSequence=0,prFundSequence=0;
const PR_HTML=`<section class="card fp-panel" id="sec-payment-review"><div class="card-header"><span class="card-title">Contribution payments</span></div><div class="fp-body">
<p>Review recent contributions, resolve payment issues and open member payment histories.</p>
<div id="pr-counts"></div>
<div class="fp-fields"><div><label for="pr-query">Member ID, name, sender or memo</label><input id="pr-query" placeholder="Search payments" onkeydown="if(event.key==='Enter')prLoad(0)"></div><div><label for="pr-filter">Show</label><select id="pr-filter" onchange="prLoad(0)"><option value="ALL">All non-registration payments</option><option value="REVIEW">Needs review</option></select></div></div>
<div class="fp-actions"><button class="hero-btn primary" onclick="prLoad(0)">Refresh payments</button><button class="hero-btn secondary" id="pr-prev" onclick="prLoad(Math.max(0,prOffset-50))">Previous page</button><button class="hero-btn secondary" id="pr-next" onclick="prLoad(prOffset+50)">Next page</button></div>
<div id="pr-message" role="status" aria-live="polite"></div><div id="pr-pending"></div><div id="pr-payments"></div>
<details style="margin-top:24px"><summary>Payment dates &amp; outstanding by fund</summary><label for="pr-fund">Fundraiser</label><select id="pr-fund" onchange="prLoadFund()"><option value="">Select a fund</option></select><div class="fp-actions"><button class="hero-btn secondary" onclick="prLoadFund()">Refresh fund list</button></div><div id="pr-fund-list"></div></details>
</div></section>`;
function prMessage(text,error){const e=document.getElementById('pr-message');if(e){e.textContent=text;e.className=error?'fp-error':'';}}
function prInvalidate(){prPreview=null;const b=document.getElementById('pr-apply');if(b)b.disabled=true;const e=document.getElementById('pr-action-preview');if(e)e.textContent='';}
function prTable(headers,rows){return '<div class="fp-table-wrap"><table><thead><tr>'+headers.map(h=>'<th>'+fpEscape(h)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+r.map(c=>'<td>'+c+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';}
function prProfileButton(id,label){return id?'<button class="hero-btn secondary" onclick="openDrawer(\''+id+'\',\'\')">'+fpEscape(label||id)+'</button>':'Unassigned';}
async function prLoad(offset=0){
 if(prBusy)return;prBusy=true;ftBusy=true;prMessage('Reading PAYMENTS…');
 try{prFeed=await fpCall('fp_review_feed',{offset,query:document.getElementById('pr-query').value,reviewOnly:document.getElementById('pr-filter').value==='REVIEW'?'YES':'NO'});prOffset=prFeed.offset;
  document.getElementById('pr-counts').innerHTML='<div class="mw-review-stats"><div class="mw-review-stat"><span>Matching payments</span><strong>'+Number(prFeed.total).toLocaleString()+'</strong></div><div class="mw-review-stat mw-review-attention"><span>Need review · all records</span><strong>'+Number(prFeed.stats.review).toLocaleString()+'</strong></div><div class="mw-review-stat mw-review-confirmed"><span>Recorded contributions</span><strong>'+fpMoney(prFeed.stats.confirmedCash)+'</strong></div></div>';
  document.getElementById('pr-prev').disabled=prOffset===0;document.getElementById('pr-next').disabled=prOffset+50>=prFeed.total;
  document.getElementById('pr-payments').innerHTML=prTable(['Payment date','Member / sender','Amount','Type / fund','Status / issues','Action'],prFeed.payments.map(r=>[
   fpEscape(r.date||'Date needs review'),prProfileButton(r.memberId,r.name||r.memberId)+'<div>'+fpEscape(r.sender)+'</div>',fpMoney(r.amount),fpEscape(r.type)+'<br>'+fpEscape(r.fund||'No fund')+'<br><small>PAYMENTS row '+r.row+'</small>','<span class="mw-payment-status '+(r.needsReview?'needs-review':'')+'">'+fpEscape(r.status)+'</span><br>'+r.reasons.map(fpEscape).join('<br>'),'<button class="hero-btn secondary" onclick="prOpenPayment('+r.row+')">'+(r.canAllocate?'Fix / allocate':'Inspect')+'</button>'
  ]));
  ['sec-members','sec-overview','sec-activity'].forEach(id=>{const e=document.getElementById(id);if(e)e.style.display='none';});
  document.querySelectorAll('#main-content .card-title').forEach(e=>{if(['Priority pulse','Eligibility status'].includes(e.textContent.trim()))e.closest('.card').style.display='none';});
  document.getElementById('pr-pending').innerHTML=prFeed.pendingAction?'<div class="fp-note">Unfinished approved action: '+fpEscape(prFeed.pendingAction)+' <button class="hero-btn secondary" onclick="prResume()">Resume approved action</button></div>':'';
  const list=await fpCall('fp_funds'),select=document.getElementById('pr-fund'),cur=select.value;select.replaceChildren(new Option('Select a fund',''));list.funds.forEach(f=>select.add(new Option(f.code+' — '+f.deceased+' ('+f.status+')',f.code)));select.value=cur;
  prMessage('Newest payments first. Open a member name for payment history.');
 }catch(e){prMessage(e.message,true);}finally{prBusy=false;ftBusy=false;}
}
async function prLoadFund(){
 const code=document.getElementById('pr-fund').value,el=document.getElementById('pr-fund-list'),seq=++prFundSequence;if(!code){el.textContent='Select a fund.';return;}
 el.textContent='Reading fund-specific payments and TRACK…';ftBusy=true;
 try{const d=await fpCall('fp_review_fund',{fundCode:code});if(seq!==prFundSequence)return;el.innerHTML=prTable(['Member','Status','Paid','Credit applied','Outstanding','Payment dates','Issues'],d.members.map(m=>[prProfileButton(m.memberId,m.name),fpEscape(m.status),fpMoney(m.paid),fpMoney(m.creditApplied),m.balance===null?'Review':fpMoney(m.balance),m.paymentDates.map(fpEscape).join('<br>')||'No recorded fund payment',m.issues.map(fpEscape).join('<br>')]));}
 catch(e){if(seq===prFundSequence)el.textContent=e.message;}finally{ftBusy=false;}
}
openDrawer=async function(memberId,memberName){
 const seq=++prProfileSequence;drawerOpen=true;document.body.style.overflow='hidden';document.getElementById('drawer-backdrop').classList.add('open');document.getElementById('member-drawer').classList.add('open');document.getElementById('drawer-name').textContent=memberName||memberId;document.getElementById('drawer-id').textContent=memberId;document.getElementById('drawer-body').textContent='Reading exact member and fund records…';
 try{const d=await fpCall('fp_review_profile',{memberId});if(seq!==prProfileSequence||!drawerOpen)return;prProfile=d;prRenderProfile();}catch(e){if(seq===prProfileSequence)document.getElementById('drawer-body').textContent=e.message;}
};
function prRenderProfile(){
 const d=prProfile;if(!d)return;prAction=null;prPreview=null;
 document.getElementById('drawer-name').textContent=d.name;document.getElementById('drawer-id').textContent=d.memberId+' · Joined '+d.joined;
 document.getElementById('drawer-body').innerHTML='<div class="fp-body"><div class="fp-note">Fund status uses each fund’s own confirmed PAYMENTS and applied TRACK credit. Available credit is not automatically deducted. This screen does not determine benefit eligibility.</div>'+
  '<h3>Member profile</h3><p>'+[d.email,d.phone,d.location].map(fpEscape).join('<br>')+'</p><h3>Funeral credit available: '+fpMoney(d.availableCredit)+'</h3><p>Stored funeral credit only (MEMBERS column S). Registration payments and historical contribution totals are not reusable credit.</p>'+
  prTable(['Fund / deadline','Status','Paid / credit applied','Outstanding','Dates paid','Action'],d.obligations.map(o=>[fpEscape(o.fundCode)+'<br>'+fpEscape(o.deceased)+'<br>'+fpEscape(o.deadline),fpEscape(o.status),fpMoney(o.paid)+' / '+fpMoney(o.creditApplied),o.balance===null?'Review':fpMoney(o.balance)+(o.lateFeePending?'<br><small>Includes $5 late fee awaiting assessment</small>':''),(o.paymentDates||[]).map(fpEscape).join('<br>')||'No fund-specific payment',d.availableCredit>0&&o.balance>0&&o.status!=='REVIEW'&&o.status!=='EXEMPT'?'<button class="hero-btn secondary" onclick="prStartCredit(\''+o.fundCode+'\')">Apply credit</button>':'']))+
  '<details><summary>Issues ('+d.issues.length+')</summary><ul>'+d.issues.map(x=>'<li>'+fpEscape(x)+'</li>').join('')+'</ul></details><h3 style="margin-top:20px">Payment history — newest first</h3>'+prTable(['Date','Fund / type','Amount','Status','Memo / source'],d.payments.map(p=>[fpEscape(p.date),fpEscape(p.fund)+'<br>'+fpEscape(p.type),fpMoney(p.amount),fpEscape(p.status),fpEscape(p.memo)+'<br>PAYMENTS row '+p.row]))+
  '<details><summary>Declared family</summary>'+Object.entries(d.family).map(([k,v])=>'<p><strong>'+fpEscape(k)+':</strong> '+fpEscape(v)+'</p>').join('')+'</details><div id="pr-action"></div></div>';
}
function prActionShell(title,body){document.getElementById('pr-action').innerHTML='<h3 style="margin:20px 0">'+fpEscape(title)+'</h3>'+body+'<div class="fp-actions"><button class="hero-btn secondary" onclick="prPreviewAction()">Dry run / preview</button><button id="pr-apply" class="hero-btn primary" disabled onclick="prApplyAction()">Confirm and apply</button><button class="hero-btn secondary" onclick="prCancelAction()">Cancel</button></div><div id="pr-action-preview" role="status" style="white-space:pre-wrap"></div>';document.getElementById('pr-action').scrollIntoView({block:'nearest'});}
function prStartCredit(code){
 const o=prProfile.obligations.find(o=>o.fundCode===code);prAction={mode:'CREDIT',requestId:crypto.randomUUID(),memberId:prProfile.memberId,fundCode:code};prPreview=null;
 prActionShell('Apply available credit to '+code,'<p>Available: '+fpMoney(prProfile.availableCredit)+'; this fund outstanding: '+fpMoney(o.balance)+'. This moves existing credit; it does not record new cash.</p><label for="pr-credit-amount">Credit to apply ($)</label><input id="pr-credit-amount" type="number" min="0.01" max="'+Math.min(o.balance,prProfile.availableCredit)+'" step="0.01" value="'+Math.min(o.balance,prProfile.availableCredit).toFixed(2)+'" oninput="prInvalidate()">');
}
function prOpenPayment(row){
 const r=prFeed?.payments.find(p=>p.row===row);if(!r)return;
 drawerOpen=true;document.body.style.overflow='hidden';document.getElementById('drawer-backdrop').classList.add('open');document.getElementById('member-drawer').classList.add('open');document.getElementById('drawer-name').textContent=r.sender||r.name||'Payment review';document.getElementById('drawer-id').textContent='PAYMENTS row '+r.row;
 document.getElementById('drawer-body').innerHTML='<div class="fp-body"><p><strong>'+fpMoney(r.amount)+'</strong> · '+fpEscape(r.date)+'<br>'+fpEscape(r.status)+'<br>Memo: '+fpEscape(r.memo||'(none)')+'<br>Notes: '+fpEscape(r.notes)+'</p>'+prProfileButton(r.memberId,'Open member profile')+'<div id="pr-action"></div></div>';
 prAction=null;prPreview=null;if(!r.canAllocate){document.getElementById('pr-action').textContent='This row cannot be allocated again. Confirmed/settled rows and reversal guards require separate investigation; no automatic reassignment.';return;}
 prAction={mode:'ALLOCATE',sourceRow:r.row,requestId:crypto.randomUUID()};
 prActionShell('Allocate this received payment','<p>Enter the exact member and fund for every share. All shares must total '+fpMoney(r.amount)+'. Choose CREDIT explicitly for an agreed excess; do not guess from a surname.</p><div id="pr-lines"></div><button class="hero-btn secondary" onclick="prAddLine()">Add allocation</button>');prAddLine(r.memberId);
}
function prAddLine(memberId=''){
 const el=document.createElement('div');el.className='pr-line';el.style.cssText='padding:12px 0;border-bottom:1px solid var(--border)';
 el.innerHTML='<label>Member ID<input class="pr-mid" placeholder="MW0001" value="'+fpEscape(memberId)+'" oninput="prInvalidate()"></label><label>Fund code or CREDIT<input class="pr-code" placeholder="FUND-011 or CREDIT" oninput="prInvalidate()"></label><label>Amount ($)<input class="pr-amt" type="number" min="0.01" step="0.01" oninput="prInvalidate()"></label><button class="hero-btn secondary" onclick="this.parentNode.remove();prInvalidate()">Remove share</button>';
 document.getElementById('pr-lines').appendChild(el);prInvalidate();
}
function prPayload(){if(!prAction)throw Error('Choose an action');const p={mode:prAction.mode,sourceRow:prAction.sourceRow||0,requestId:prAction.requestId};p.allocations=prAction.mode==='CREDIT'?[{memberId:prAction.memberId,fundCode:prAction.fundCode,amount:document.getElementById('pr-credit-amount').value}]:Array.from(document.querySelectorAll('.pr-line')).map(e=>({memberId:e.querySelector('.pr-mid').value.trim().toUpperCase(),fundCode:e.querySelector('.pr-code').value.trim().toUpperCase(),amount:e.querySelector('.pr-amt').value}));return p;}
async function prPreviewAction(){
 if(prBusy)return;prBusy=true;ftBusy=true;prInvalidate();const el=document.getElementById('pr-action-preview');el.textContent='Dry run…';
 try{const payload=prPayload(),d=await fpCall('fp_review_preview',payload);if(d.alreadyRecorded){el.textContent=d.message;return;}prPreview={payload,input:d.input,token:d.previewToken};el.textContent=d.message+'\n'+d.plan.allocations.map(a=>a.memberId+' '+a.fundCode+' '+fpMoney(a.amount)+(a.newBalance!==undefined?' → remaining '+fpMoney(a.newBalance):' added as available credit')+(a.lateFeeAssessed?' | includes assessment of $5 late fee':'')).join('\n')+'\nTarget cells: '+d.plan.targets.map(t=>t.sheet+' row '+t.row+' column '+t.column).join('; ');document.getElementById('pr-apply').disabled=false;}
 catch(e){el.textContent=e.message;}finally{prBusy=false;ftBusy=false;}
}
async function prApplyAction(){
 if(prBusy||!prPreview)return;
 if(JSON.stringify(prPayload())!==JSON.stringify(prPreview.payload)){prInvalidate();return;}
 if(!confirm('Apply only the allocations shown in the dry run? This changes the specified ledger/tracker/credit records. A confirmation email will be sent after completion.'))return;
 const refreshMember=prAction?.mode==='CREDIT'?prAction.memberId:'';let applied=false;
 prBusy=true;ftBusy=true;const el=document.getElementById('pr-action-preview');document.getElementById('pr-apply').disabled=true;
 try{const d=await fpCall('fp_review_apply',{...prPreview.input,previewToken:prPreview.token,confirmed:'YES'});el.textContent=d.message;applied=true;prPreview=null;prAction=null;prMessage('Action recorded. Refresh payments and the member profile to verify.');}
 catch(e){el.textContent=e.message+' Keep the same request. Do not create a new request to bypass a hold.';document.getElementById('pr-apply').disabled=false;}finally{prBusy=false;ftBusy=false;}
 if(applied){if(typeof showToast==='function')showToast('Approved payment action recorded. Refreshing records.',5000);await prLoad(prOffset);if(refreshMember)await openDrawer(refreshMember,'');}
}
function prCancelAction(){if(prBusy)return;prAction=null;prPreview=null;document.getElementById('pr-action').replaceChildren();}
async function prResume(){if(prBusy||!prFeed?.pendingAction)return;if(!confirm('Resume the previously approved request '+prFeed.pendingAction+'? Changed target cells will stop the operation for review.'))return;prBusy=true;ftBusy=true;try{const d=await fpCall('fp_review_resume',{requestId:prFeed.pendingAction,confirmed:'YES'});prMessage(d.message);}catch(e){prMessage(e.message,true);}finally{prBusy=false;ftBusy=false;}}
runMemberLookup=function(){
 const query=document.getElementById('lookup-input').value.trim().toLowerCase(),el=document.getElementById('lookup-results');
 if(!query){el.textContent='Enter a member ID or name.';return;}
 const matches=allMembers.filter(m=>[m.id,m.name,m.email].some(v=>String(v||'').toLowerCase().includes(query)));
 if(matches.length===1){openDrawer(matches[0].id,matches[0].name);return;}
 el.innerHTML=matches.slice(0,20).map(m=>'<div style="margin:8px 0">'+prProfileButton(m.id,m.name+' ('+m.id+')')+'</div>').join('')||'No matching member found.';
};
(function mountPaymentReview(){
 const previousBusy=isFixToolBusy;isFixToolBusy=function(){const section=document.getElementById('sec-payment-review');return prBusy||!!prAction||!!prPreview||!!(section&&section.contains(document.activeElement))||previousBusy();};
 function mount(){
  const target=document.querySelector('#main-content .two-col');if(!target||document.getElementById('sec-payment-review'))return;
  target.insertAdjacentHTML('beforebegin',PR_HTML);
  if(typeof mwArrangeWorkspace==='function')mwArrangeWorkspace();
  prLoad(0);
 }
 new MutationObserver(mount).observe(document.getElementById('main-content'),{childList:true,subtree:true});mount();
})();
