const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path'),crypto=require('crypto');
const root=fs.existsSync(path.join(__dirname,'MW_PayoutDashboard.js'))?__dirname:path.resolve(__dirname,'..');const payout=fs.readFileSync(path.join(root,'MW_PayoutDashboard.js'),'utf8');
const review=fs.readFileSync(path.join(root,'MW_PaymentReview.js'),'utf8');
new vm.Script(payout);new vm.Script(review);
// A deliberately small DOM fixture checks node identity and mounting across refreshes.
const nodes=new Map();let creations=0;
class El{
 set id(value){this._id=value;if(value)nodes.set(value,this);}
 get id(){return this._id;}
 constructor(id='',classes=[]){this.id=id;this.children=[];this.parentNode=null;this.attrs={};this.style={};this.textContent='';this.classes=new Set(classes);this.classList={add:c=>this.classes.add(c),toggle:(c,yes)=>yes?this.classes.add(c):this.classes.delete(c)};if(id)nodes.set(id,this);}
 append(el){if(el.parentNode)el.parentNode.children=el.parentNode.children.filter(x=>x!==el);this.children.push(el);el.parentNode=this;}
 prepend(el){this.append(el);this.children=this.children.filter(x=>x!==el);this.children.unshift(el);}
 before(el){const parent=this.parentNode;parent.append(el);parent.children=parent.children.filter(x=>x!==el);parent.children.splice(parent.children.indexOf(this),0,el);}
 querySelector(selector){return this.walk().find(x=>selector.startsWith('.')?x.classes.has(selector.slice(1)):x.id===selector.slice(1))||null;}
 querySelectorAll(selector){return this.walk().filter(x=>x.classes.has(selector.slice(1)));}
 walk(){return this.children.flatMap(x=>[x,...x.walk()]);}
 closest(selector){let el=this;while(el){if(el.classes.has(selector.slice(1)))return el;el=el.parentNode;}return null;}
 setAttribute(k,v){this.attrs[k]=v;}focus(){document.activeElement=this;}
 set innerHTML(value){this.html=value;if(value.includes('mw-work-panels')){
  const left=new El('mw-work-main'),tabs=new El('', ['mw-work-tabs']),panels=new El('mw-work-panels'),side=new El('mw-sidebar');
  left.append(tabs);tabs.append(new El('mw-tab-payments'));tabs.append(new El('mw-tab-payouts'));left.append(panels);this.append(left);this.append(side);
 }}
}
const document={body:new El('body'),getElementById:id=>nodes.get(id)||null,createElement:()=>{creations++;return new El();},querySelector:selector=>selector==='#sec-funds .card-title'?nodes.get('sec-funds').querySelector('.card-title'):null};
const main=new El('main-content'),legacy=new El('', ['two-col']),lookup=new El('', ['card']),input=new El('lookup-input');lookup.append(input);main.append(lookup);main.append(legacy);
const right=new El('', ['right-col']),capacity=new El('capacity', ['card']),funds=new El('sec-funds',['card']),title=new El('', ['card-title']);title.textContent='Active funeral funds';funds.append(title);right.append(capacity);right.append(funds);legacy.append(right);
const pay=new El('sec-family-payouts'),feed=new El('sec-payment-review');const form=new El('fp-form');form.value='unsaved payout';const handler=()=>{};form.onsubmit=handler;pay.append(form);main.append(pay);main.append(feed);
const context={document};vm.createContext(context);
const section=payout.slice(payout.indexOf("let mwWorkspaceView="),payout.indexOf('(function mountPayoutSection'));
vm.runInContext(section,context);context.mwArrangeWorkspace();
const shell=nodes.get('mw-workspace'),left=nodes.get('mw-work-main'),side=nodes.get('mw-sidebar');
assert(shell);assert.equal(right.parentNode,side);assert.equal(capacity.parentNode,right);assert.equal(funds.parentNode,right);assert.equal(lookup.parentNode,left);
assert.equal(pay.parentNode,nodes.get('mw-work-panels'));assert.equal(feed.parentNode,pay.parentNode);assert(pay.classes.has('mw-view-hidden'));assert(!feed.classes.has('mw-view-hidden'));
context.mwSelectWorkspace('payouts');assert(!pay.classes.has('mw-view-hidden'));assert(feed.classes.has('mw-view-hidden'));assert.equal(form.value,'unsaved payout');assert.equal(form.onsubmit,handler);
const count=creations;for(let i=0;i<20;i++)context.mwArrangeWorkspace();assert.equal(creations,count);assert.equal(nodes.get('mw-workspace'),shell);assert.equal(form.value,'unsaved payout');assert.equal(nodes.get('mw-tab-payouts').attrs['aria-selected'],'true');
context.mwWorkspaceKey({key:'Home',preventDefault(){}});assert.equal(document.activeElement,nodes.get('mw-tab-payments'));assert(!feed.classes.has('mw-view-hidden'));
// Financial functions remain byte-for-byte identical to the prior reviewed version.
function between(s,start,end){return s.slice(s.indexOf(start),s.indexOf(end,s.indexOf(start)));}
const hashes=[["MW_PayoutDashboard.js", "async function fpPreviewPayment", "async function fpSavePayment", "7065f0ebac7e48599d436e0d54b51be43010271fc39684440d12addf0ac7ce96"], ["MW_PayoutDashboard.js", "async function fpSavePayment", "function fpResetPayment", "2802a5514a6c7186b4e7adfecf413b5d426b052b03cc6fd776f334f3009c2652"], ["MW_PaymentReview.js", "async function prPreviewAction", "async function prApplyAction", "0600c63c1f6792b20efb69d10df6b094dcab6ef1f12384c3edf7e48fd13d33b9"], ["MW_PaymentReview.js", "async function prApplyAction", "function prCancelAction", "ac01c3c0100ca08b9db63ad4abb92de87c5701010b2161ddb6b9e406b79d3f04"], ["MW_PaymentReview.js", "async function prResume", "runMemberLookup=", "ef77bb87efbd48b8f0c520d8359be17d0b7095b920dcd97b8565e6a330350013"]];
for(const [file,start,end,hash] of hashes){const source=file==='MW_PayoutDashboard.js'?payout:review;assert.equal(crypto.createHash('sha256').update(between(source,start,end)).digest('hex'),hash);}
console.log('PASS: sidebar placement; main workspace; original node/form identity; unsaved values retained; repeated mounting without duplicates; keyboard tab selection; financial preview/apply/resume functions unchanged.');
