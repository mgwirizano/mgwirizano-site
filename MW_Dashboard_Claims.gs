// Read-only claim history. Never changes beneficiaries, obligations or fund records.
function _mwClaimName_(value){
  return String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/^\s*(?:mr|mrs|ms|miss|dr)\.?\s+/,'').replace(/[^a-z0-9]+/g,' ').trim();
}
function _mwClaimRelation_(value){
 var r=String(value||'').trim().toLowerCase();
 if(/^(father|dad)\b/.test(r))return 'father';if(/^(mother|mum|mom)\b/.test(r))return 'mother';
 if(/^(spouse|wife|husband)\b/.test(r))return 'spouse';if(/^(child|children|son|daughter)\b/.test(r))return 'children';
 if(/^(sibling|brother|sister)\b/.test(r))return 'siblings';if(/^(self|member)\b/.test(r))return 'self';return '';
}
function _mwClaimNames_(value){
 var text=String(value||'').trim();if(!text||/^(n\/?a|none|not applicable|unknown|-+)$/i.test(text))return [];
 return text.split(/\r?\n|;|,|\s+\d+[.)]\s+/).map(function(n){return n.replace(/^\s*\d+[.)]\s*/,'').trim();}).filter(function(n){return n&&!/^(n\/?a|none)$/i.test(n);});
}
function _mwClaimProfile_(id,family){
 var ss=_mwPrSS_(),rows=_mwPrValues_(ss.getSheetByName('FUNDS')),claims=[],warnings=[],seen={};
 rows.forEach(function(r,i){var code=_mwPrText_(r[0]).toUpperCase();if(!/^FUND-\d{3}$/.test(code))return;
  if(seen[code])warnings.push('Duplicate FUNDS code '+code+'; investigate claim records');seen[code]=true;
  var memberId=_mwPrId_(r[11]),deceased=_mwPrText_(r[2]),status=_mwPrText_(r[8]).toUpperCase();
  var opened=r[3] instanceof Date&&!isNaN(r[3].getTime())?Utilities.formatDate(r[3],ss.getSpreadsheetTimeZone(),'yyyy-MM-dd'):'';
  claims.push({fundCode:code,deceased:deceased,relationship:_mwPrText_(r[10]),relationshipKey:_mwClaimRelation_(r[10]),memberId:memberId,
   fundOpenedDate:opened,fundStatus:status,recordedClaim:['ACTIVE','CLOSED'].indexOf(status)>=0,sourceRow:i+1});
 });
 var own=claims.filter(function(c){return c.memberId===id;});
 var beneficiaries=[];
 Object.keys(family).forEach(function(relation){_mwClaimNames_(family[relation]).forEach(function(name){
  var key=_mwClaimName_(name),fullName=key.split(' ').length>=2;
  var matches=own.filter(function(c){return c.recordedClaim&&fullName&&_mwClaimName_(c.deceased)===key&&c.relationshipKey===relation;});
  var possible=claims.filter(function(c){
   if(matches.indexOf(c)>=0)return false;
   if(fullName&&_mwClaimName_(c.deceased)===key)return true;
   // A historic parent/spouse claim with a changed or abbreviated name requires identity review.
   return c.memberId===id&&c.recordedClaim&&c.relationshipKey===relation&&['father','mother','spouse'].indexOf(relation)>=0;
  });
  beneficiaries.push({name:name,relationship:relation,status:matches.length?'PREVIOUSLY_CLAIMED':possible.length?'REVIEW':'NO_PRIOR_CLAIM_FOUND',
   label:matches.length?'Not qualified — previously claimed':possible.length?'Possible previous claim — verify identity':'No previous claim found',
   claims:matches,possibleClaims:possible,canClaimAgain:matches.length?false:null});
 });});
 return {claimedFunds:own.sort(function(a,b){return b.fundOpenedDate.localeCompare(a.fundOpenedDate)||b.fundCode.localeCompare(a.fundCode);}),beneficiaries:beneficiaries,claimWarnings:warnings,
  claimPolicyNote:'A previous claim under the same member, full name and relationship is marked not qualified for another claim. Cross-member or ambiguous name matches require identity review. No prior claim found is not an eligibility approval. Dates shown are when the fund was opened, not the date of death. No unique beneficiary ID is recorded in the supplied schema.'};
}
