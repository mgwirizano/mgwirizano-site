/* Integer-cent, append-only ledger. Shared by Apps Script and the preview. */
var MWLedger = (function () {
  'use strict';
  function cents(value) {
    var s = String(value).trim();
    if (!/^\d+(\.\d{1,2})?$/.test(s)) throw new Error('Enter an amount with at most two decimal places.');
    var n = Math.round(Number(s) * 100);
    if (!Number.isSafeInteger(n) || n <= 0 || n > 100000000) throw new Error('Amount is outside the allowed range.');
    return n;
  }
  function state(events, memberId) {
    var s = { credit: 0, received: 0, charges: [], events: [], openingRecorded: false };
    var byId = {};
    events.filter(function (e) { return e.memberId === memberId; }).forEach(function (e) {
      s.events.push(e);
      if (e.kind === 'CHARGE') {
        var c = { id: e.id, key: e.chargeKey, title: e.title, due: e.amount, remaining: e.amount, date: e.at };
        s.charges.push(c); byId[e.id] = c;
      }
      if (e.kind === 'OPENING_CREDIT') { s.credit += e.amount; s.openingRecorded = true; }
      if (e.kind === 'PAYMENT') { s.credit += e.amount; s.received += e.amount; }
      if (e.kind === 'REFUND') s.credit -= e.amount;
      (e.allocations || []).forEach(function (a) {
        if (!byId[a.chargeId]) throw new Error('Ledger contains an allocation without its charge.');
        byId[a.chargeId].remaining -= a.amount;
        s.credit -= a.amount;
      });
      if (e.kind === 'REVERSAL') { s.credit -= e.amount; s.received -= e.amount; }
    });
    if (s.credit < 0 || s.charges.some(function (c) { return c.remaining < 0 || c.remaining > c.due; })) throw new Error('Ledger reconciliation is required.');
    s.outstanding = s.charges.reduce(function (sum, c) { return sum + c.remaining; }, 0);
    return s;
  }
  function create(events, input, actor, now, id) {
    var existing = events.find(function (e) { return e.requestId === input.requestId; });
    var fingerprint = JSON.stringify([input.kind,input.memberId,input.amount,input.chargeKey,input.title,input.reference,input.scope,input.targetId,input.note,input.autoApply]);
    if (existing) {
      if (existing.fingerprint !== fingerprint || existing.actor !== actor) throw new Error('This request identifier was used for a different transaction.');
      return { event: existing, duplicate: true };
    }
    if (!/^[A-Za-z0-9_-]{8,100}$/.test(input.requestId || '')) throw new Error('A unique request identifier is required.');
    if (!/^MW\d{4}$/.test(input.memberId || '')) throw new Error('Select a valid member.');
    if (!String(input.note || '').trim()) throw new Error('A reason or reconciliation note is required.');
    var s = state(events, input.memberId);
    var e = { id:id, at:now, requestId:input.requestId, fingerprint:fingerprint, actor:actor, memberId:input.memberId,
      kind:input.kind, title:String(input.title || '').slice(0,150), note:String(input.note).slice(0,1000), amount:0, allocations:[] };
    function allocate(budget, charges) {
      charges.forEach(function (c) { var n = Math.min(budget,c.remaining); if(n>0){e.allocations.push({chargeId:c.id,amount:n});budget-=n;} });
    }
    if (e.kind === 'CHARGE') {
      e.amount=cents(input.amount);e.chargeKey=String(input.chargeKey || '').trim();
      if (!/^[A-Z0-9_-]{3,80}$/.test(e.chargeKey) || !e.title) throw new Error('A charge key and description are required.');
      if (events.some(function (x) { return x.memberId===e.memberId && x.kind==='CHARGE' && x.chargeKey===e.chargeKey; })) throw new Error('This obligation is already recorded for the member.');
      if(input.autoApply===true && s.credit>0)e.allocations.push({chargeId:e.id,amount:Math.min(s.credit,e.amount)});
    } else if (e.kind === 'OPENING_CREDIT') {
      if (s.openingRecorded) throw new Error('An opening credit is already recorded.');
      e.amount=cents(input.amount);
    } else if (e.kind === 'PAYMENT') {
      e.amount=cents(input.amount); e.reference=String(input.reference || '').trim().toUpperCase();
      if (!/^[A-Z0-9_-]{4,100}$/.test(e.reference)) throw new Error('Enter the unique bank/payment reference.');
      if (events.some(function (x) { return x.kind==='PAYMENT' && x.reference===e.reference; })) throw new Error('This payment reference has already been posted.');
      e.scope=input.scope;
      if (e.scope==='oldest') allocate(e.amount,s.charges);
      else if (e.scope!=='advance') {
        var selected=s.charges.filter(function(c){return c.id===e.scope;});
        if(selected.length!==1)throw new Error('Choose a specific obligation, oldest outstanding, or advance credit.');
        allocate(e.amount,selected);
      }
    } else if (e.kind === 'APPLY_CREDIT') {
      if (s.credit<=0 || s.outstanding<=0)throw new Error('There is no available credit to apply to outstanding obligations.');
      allocate(s.credit,s.charges);
    } else if (e.kind === 'REFUND') {
      e.amount=cents(input.amount);
      if(e.amount>s.credit)throw new Error('Refund cannot exceed available credit.');
    } else if (e.kind === 'REVERSAL') {
      var target=events.find(function(x){return x.id===input.targetId && x.memberId===e.memberId && x.kind==='PAYMENT';});
      if(!target)throw new Error('Select the original payment.');
      if(events.some(function(x){return x.kind==='REVERSAL'&&x.targetId===target.id;}))throw new Error('That payment is already reversed.');
      e.targetId=target.id;e.amount=target.amount;e.allocations=target.allocations.map(function(a){return{chargeId:a.chargeId,amount:-a.amount};});
      var unallocated=target.amount-target.allocations.reduce(function(sum,a){return sum+a.amount;},0);
      if(unallocated>s.credit)throw new Error('Credit from this payment has been used. Reconcile subsequent allocations before reversal.');
    } else throw new Error('Unsupported ledger action.');
    state(events.concat([e]),e.memberId);
    return {event:e,duplicate:false};
  }
  return { cents:cents, state:state, create:create };
})();

