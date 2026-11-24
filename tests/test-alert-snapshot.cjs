const fs=require('fs'),vm=require('vm'),assert=require('assert'),{env}=require('./test-admin.cjs');
function run(old){const e=env();vm.runInContext(fs.readFileSync(__dirname+'/../MW_Dashboard_Actions.gs','utf8'),e.c);if(old)vm.runInContext(fs.readFileSync(__dirname+'/fixtures/alerts-v48.gs','utf8'),e.c);
 for(let i=0;i<4000;i++)e.data.PAYMENTS.push(e.data.PAYMENTS[10].slice());
 let zones=0,lookups=0;const zone=e.ss.getSpreadsheetTimeZone,lookup=e.ss.getSheetByName;
 e.ss.getSpreadsheetTimeZone=(...a)=>{zones++;return zone(...a);};e.ss.getSheetByName=(...a)=>{lookups++;return lookup(...a);};
 const original=e.c.MWPR_SS,cache=e.c.MWPR_READ_CACHE,result=e.c._mwOpsAlerts_();
 if(!old){assert.strictEqual(e.c.MWPR_SS,original);assert.strictEqual(e.c.MWPR_READ_CACHE,cache);}
 assert.equal(e.writes(),0);assert.equal(e.emails(),0);return {result:JSON.parse(JSON.stringify(result)),zones,lookups};}
const old=run(true),now=run(false);assert.deepEqual(now.result,old.result);assert(old.zones>4000);assert(now.zones<20);assert(now.zones*100<old.zones);
const e=env();e.c._mwOpsAlertsRead_=()=>{throw Error('Read failed');};const ss=e.c.MWPR_SS,cache=e.c.MWPR_READ_CACHE;assert.throws(()=>e.c._mwOpsAlerts_(),/Read failed/);assert.strictEqual(e.c.MWPR_SS,ss);assert.strictEqual(e.c.MWPR_READ_CACHE,cache);
console.log('PASS snapshot: same alerts with 4,000 extra payment rows; timezone service calls '+old.zones+' → '+now.zones+'; sheet lookups '+old.lookups+' → '+now.lookups+'; state restored on success/failure; zero writes/emails.');
