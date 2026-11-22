function _crGoodStandingText_() {
  return 'GOOD STANDING — Article II, Section 4\n"All arrears must be cleared in full before a member regains good standing and benefit eligibility. Partial payment does not restore eligibility."\n' +
    "Zero-miss policy: any unpaid required funeral contribution means you are not in good standing. We will not open a funeral fundraiser for you or pay you funeral-fund benefits while you are not in good standing. Approved exemptions do not count as missed payments. You may not vote or participate in organizational decision-making while ineligible.\n\n" +
    "72-HOUR PROBATION: Your registration fee, all contribution arrears and applicable late fees must be settled in full and verified. A 72-hour probation then applies before benefits may be restored. No fund will be opened or paid during probation. Partial payment does not restore benefits or start probation. Restoration remains subject to the constitution's other requirements; payment or passage of 72 hours alone does not automatically restore eligibility.";
}
// The 72-hour period is leadership's notice policy; it is not part of the quoted Section 4.
function _crBatchPayment_(g) {
  var surnames=[], valid=true, amount=g.items.length ? Number(g.items[0].totalDue) : 0;
  g.items.forEach(function(x) {
    var name=String(x.deceased || "").trim();
    if (!name) { valid=false; return; }
    var surname=name.split(/\s+/).pop();
    if (surnames.indexOf(surname)>=0) valid=false;
    surnames.push(surname);
    if (Math.abs(Number(x.totalDue)-amount)>0.005) valid=false;
  });
  if (valid && surnames.length>1) return "Pay all "+g.items.length+" listed funds together: send $"+_crMoney_(g.totalDue)+" with memo: "+g.id+" "+surnames.join(" ")+". The payment will split equally: $"+_crMoney_(amount)+" per fund.";
  return "Use separate payments with the individual memos above to settle all listed funds, because their balances differ or a combined memo needs clarification.";
}
function _crPaymentText_(g) {
  return _crBatchPayment_(g)+"\nYou may also combine selected funds or make partial payments if the amount splits equally across the funds named in your memo, without exceeding any fund's balance. Use separate payments for unequal amounts. Partial payment does not restore good standing or benefit eligibility.";
}
function _crBuildMemberEmail_(cfg, g) {
  var rows="";
  g.items.forEach(function(x) {
    rows+="<tr><td style='padding:9px;border-bottom:1px solid #ddd;'>"+_crHtml_(x.fund)+"<br><span style='color:#666;font-size:11px;'>Closed / due: "+_crHtml_(x.deadline || "Not recorded")+"</span></td>"+
      "<td style='padding:9px;border-bottom:1px solid #ddd;'>"+_crHtml_(x.deceased || x.fundName)+"</td>"+
      "<td style='padding:9px;border-bottom:1px solid #ddd;text-align:right;'>$"+_crMoney_(x.contributionDue)+"</td>"+
      "<td style='padding:9px;border-bottom:1px solid #ddd;text-align:right;'>$"+_crMoney_(x.lateFee)+"</td>"+
      "<td style='padding:9px;border-bottom:1px solid #ddd;text-align:right;font-weight:bold;'>$"+_crMoney_(x.totalDue)+"</td>"+
      "<td style='padding:9px;border-bottom:1px solid #ddd;'>"+_crHtml_(x.memo)+"</td></tr>";
  });
  var header=emailHeader(cfg,"Consolidated Outstanding Payment Reminder").replace(/height:7px;display:flex;/,"height:0;display:none;");
  var standing=_crStandingHtml_();
  return "<div style='margin:0;padding:0;background:#f0ece4;font-family:Arial,sans-serif;'><div style='max-width:800px;margin:auto;background:#fff;'>"+header+
    "<div style='padding:12px 26px 24px;'><p style='margin:0 0 12px;'>Dear <strong>"+_crHtml_(g.name.split(/\s+/)[0])+"</strong>,</p>"+
    "<p style='margin:0 0 16px;line-height:1.5;'>Our records show the following outstanding funeral-fund obligations, combined into one reminder.</p>"+
    "<table style='width:100%;border-collapse:collapse;font-size:12px;'><tr style='background:#0a1a2e;color:white;'>"+
    ["Fund / closing date","Deceased","Contribution","Late fee","Due","Required memo"].map(function(label){return "<th style='padding:9px;text-align:left;'>"+label+"</th>";}).join("")+"</tr>"+rows+"</table>"+
    "<div style='margin-top:16px;background:#fff3f3;border:1px solid #c00;padding:14px;text-align:center;'><div style='font-size:12px;'>TOTAL OUTSTANDING</div><div style='font-size:32px;font-weight:bold;color:#9a0000;'>$"+_crMoney_(g.totalDue)+"</div></div>"+
    "<div style='margin:20px 0;background:#eaf5ed;border:2px solid #217B31;padding:20px;text-align:center;'><div style='font-size:14px;font-weight:bold;color:#174f24;margin-bottom:10px;'>SEND YOUR PAYMENT WITH ZELLE</div><a style='font-size:22px;font-weight:bold;color:#174f24;text-decoration:none;word-break:break-word;' href='mailto:"+_crHtml_(cfg.zelleEmail)+"'>"+_crHtml_(cfg.zelleEmail)+"</a></div>"+
    "<div style='background:#f3f7fa;padding:18px;line-height:1.6;'><strong style='font-size:16px;'>Paying multiple funds</strong>"+_crPaymentHtml_(g)+"</div>"+
    standing+
    "<div style='margin-top:22px;padding:18px;background:#f3f7fa;line-height:1.6;'><strong style='font-size:16px;'>Already paid? Let us review it.</strong><p style='margin:10px 0;'>Reply to this email at <a href='mailto:"+_crHtml_(cfg.reminderAdminEmail)+"'>"+_crHtml_(cfg.reminderAdminEmail)+"</a>.</p><p style='margin:0;'>Include your member ID, fund name(s), payment date and amount, plus a confirmation or screenshot. We will investigate and correct any recording error.</p></div>"+
    "</div>"+emailFooter(cfg)+"</div></div>";
}
function _crBuildPlainText_(cfg, g) {
  var lines=["Dear "+g.name.split(/\s+/)[0]+",", "", "Outstanding funeral-fund obligations:", ""];
  g.items.forEach(function(x) { lines.push(x.fund+" — "+(x.deceased || x.fundName)+" | Closed / due: "+(x.deadline || "Not recorded")+" | Contribution: $"+_crMoney_(x.contributionDue)+" | Late fee: $"+_crMoney_(x.lateFee)+" | Due: $"+_crMoney_(x.totalDue)+" | Memo: "+x.memo); });
  lines.push("", "TOTAL OUTSTANDING: $"+_crMoney_(g.totalDue), "Zelle: "+cfg.zelleEmail, "", _crPaymentText_(g), "", _crGoodStandingText_(), "", "Already paid? Reply to "+cfg.reminderAdminEmail+" with your member ID, fund name(s), payment date, amount, and confirmation or screenshot so we can investigate.", "", cfg.groupName);
  return lines.join("\n");
}
function _crMoney_(value) {
  return (Number(value) || 0).toFixed(2).replace(/\.00$/, "");
}
function _crHtml_(value) {
  return String(value == null ? "" : value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}

function _crPaymentHtml_(g) {
  var batch=_crBatchPayment_(g), match=batch.match(/^(.*?) with memo: (.*?)\. The payment will split equally: (.*)$/);
  var html;
  if (match) html="<p style='margin:10px 0;'>"+_crHtml_(match[1])+".</p><div style='background:#fff;border:1px solid #a9bdcc;padding:12px;font-size:16px;font-weight:bold;word-break:break-word;'>"+_crHtml_(match[2])+"</div><p style='margin:10px 0;'>Equal allocation: "+_crHtml_(match[3])+"</p>";
  else html="<p>"+_crHtml_(batch)+"</p>";
  return html+"<p style='margin:14px 0 0;'>Selected funds and partial payments may also be combined when the payment splits equally across the named funds without exceeding any balance. Use separate payments for unequal amounts.</p><p style='margin:10px 0 0;'><strong>Partial payment does not restore good standing or benefits.</strong></p>";
}
function _crStandingHtml_() {
  return "<div style='margin-top:22px;padding:18px;border-left:4px solid #c00;background:#fff8f0;line-height:1.6;'><strong style='font-size:16px;'>Good standing — Article II, Section 4</strong>"+
    "<p style='margin:12px 0;font-style:italic;'>“All arrears must be cleared in full before a member regains good standing and benefit eligibility. Partial payment does not restore eligibility.”</p>"+
    "<p style='margin:12px 0 0;'><strong>Zero-miss policy:</strong> Any unpaid required funeral contribution means you are not in good standing. Approved exemptions do not count as missed payments.</p>"+
    "<ul style='margin:12px 0 0;padding-left:22px;'><li style='margin-bottom:8px;'><strong>We will not open a funeral fundraiser for you or pay you funeral-fund benefits</strong> while you are not in good standing.</li><li>You may not vote or participate in organizational decision-making while ineligible.</li></ul></div>"+
    "<div style='margin-top:18px;padding:18px;background:#f3f7fa;border-left:4px solid #0a1a2e;line-height:1.6;'><strong style='font-size:16px;'>Restoring benefits: 72-hour probation</strong>"+
    "<ol style='margin:12px 0;padding-left:22px;'><li style='margin-bottom:10px;'>Settle your registration fee, all contribution arrears and applicable late fees <strong>in full</strong>.</li><li style='margin-bottom:10px;'>After full payment is received and verified, complete the <strong>72-hour probation</strong>.</li><li>Benefits may then be restored, subject to the constitution’s other requirements.</li></ol>"+
    "<p style='margin:0;'><strong>No fund will be opened or paid during probation.</strong> Partial payment does not restore benefits or start probation. Payment or passage of 72 hours alone does not automatically restore eligibility.</p></div>";
}
