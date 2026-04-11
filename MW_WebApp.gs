// ============================================================
// SUPABASE MIGRATION — Run when ready to move off Google Sheets
// Free tier: 500MB, 50k requests/day, handles 2000+ members
// Schema at: https://supabase.com (create free project)
//
// Step 1: Create tables in Supabase SQL editor:
//   CREATE TABLE members (
//     member_id TEXT PRIMARY KEY,
//     email TEXT, name TEXT, phone TEXT, location TEXT,
//     gender TEXT, relationship TEXT, father TEXT, mother TEXT,
//     spouse TEXT, children TEXT, siblings TEXT, emergency TEXT,
//     prior_contrib NUMERIC DEFAULT 0, funeral_credit NUMERIC DEFAULT 0,
//     reg_status TEXT DEFAULT 'UNPAID', joined_at TIMESTAMPTZ DEFAULT NOW()
//   );
//   CREATE TABLE payments (
//     id SERIAL PRIMARY KEY, member_id TEXT, name TEXT,
//     amount NUMERIC, pay_type TEXT, fund TEXT,
//     prev_balance NUMERIC, new_balance NUMERIC,
//     memo TEXT, status TEXT, paid_at TIMESTAMPTZ DEFAULT NOW()
//   );
//
// Step 2: Get your Supabase URL + anon key from project settings
// Step 3: Store in Script Properties: SUPABASE_URL, SUPABASE_KEY
// Step 4: Replace getSpreadsheet() calls with Supabase fetch() calls
// Step 5: Keep Google Sheets as read-only audit log
// ============================================================

// ── Safe local fallbacks (in case other .gs files have errors) ──────
function _mwGetSS() {
  try {
    // Try the shared function first
    if (typeof getSpreadsheet === 'function') return getSpreadsheet();
  } catch(e) {}
  // Fallback: read directly from script properties
  var id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  return SpreadsheetApp.openById(id);
}

function _mwGetCfg(ss) {
  try {
    if (typeof getSettings === 'function') return getSettings();
  } catch(e) {}
  var s = ss.getSheetByName('SETTINGS');
  return {
    regFee:      parseFloat(s.getRange('B1').getValue()) || 25,
    groupName:   s.getRange('B2').getValue(),
    leaderEmail: s.getRange('B3').getValue(),
    zelleEmail:  s.getRange('B4').getValue(),
    funeralAmt:  10
  };
}

function _mwLog(fn, msg, status) {
  try { if (typeof logAction === 'function') logAction(fn, msg, status); } catch(e) {}
}

// Called by scanZellePayments to record health data
function _mwRecordScannerRun(count, error) {
  try {
    var props = PropertiesService.getScriptProperties();
    props.setProperty("LAST_SCANNER_RUN", Date.now().toString());
    props.setProperty("LAST_SCANNER_COUNT", (count||0).toString());
    if (error) props.setProperty("LAST_SCANNER_ERROR", error.toString().substring(0,200));
    else props.deleteProperty("LAST_SCANNER_ERROR");
  } catch(e) {}
}

function _mwSendEmail(to, subj, body, opts) {
  try {
    if (typeof sendEmail === 'function') return sendEmail(to, subj, body, opts);
    GmailApp.sendEmail(to, subj, body, opts);
    return true;
  } catch(e) { return false; }
}

// ============================================================
// MGWIRIZANO WATSOPANO — WEB APP HANDLER
// MW_WebApp.gs
//
// Handles POST requests from:
//   - register.html  (public registration form)
//   - intake.html    (leadership offline intake form)
//
// HOW IT WORKS:
//   1. Form submits JSON to the Apps Script web app URL
//   2. doPost(e) receives it and parses the data
//   3. Writes a new row to MEMBERS sheet
//   4. Triggers the same onFormSubmit logic as Google Form
//
// IMPORTANT — After adding this file:
//   1. Go to Apps Script → Deploy → Manage Deployments
//   2. Click the pencil (edit) on your current deployment
//   3. Change "Execute as" → Me
//   4. Change "Who has access" → Anyone
//   5. Click Deploy — copy the new URL
//   6. Update SCRIPT_URL in register.html and intake.html
// ============================================================

function doPost(e) {
  try {
    // Parse incoming JSON from the form
    var raw  = e.postData ? e.postData.contents : "{}";
    var data = JSON.parse(raw);

    var ss           = _mwGetSS();
    var membersSheet = ss.getSheetByName("MEMBERS");
    var settingsSheet = ss.getSheetByName("SETTINGS");

    if (!membersSheet) {
      return jsonResponse({ status: "error", message: "MEMBERS sheet not found" });
    }

    // ── Clean and format incoming data ──────────────────────
    function tc(str) {
      if (!str) return "";
      return str.toString().toLowerCase().split(" ").map(function(w) {
        return w.charAt(0).toUpperCase() + w.slice(1);
      }).join(" ");
    }

    function fmtPhone(p) {
      if (!p) return "";
      var d = p.toString().replace(/\D/g, "");
      if (d.length === 10) return d.substring(0,3)+"-"+d.substring(3,6)+"-"+d.substring(6,10);
      if (d.length === 11 && d.charAt(0) === "1") return d.substring(1,4)+"-"+d.substring(4,7)+"-"+d.substring(7,11);
      return p.toString().trim();
    }

    var now          = new Date();
    var fullName     = tc(data.fullName     || "");
    var email        = (data.email          || "").toString().trim().toLowerCase();
    var phone        = fmtPhone(data.phone  || "");
    var location     = tc(data.location     || "");
    var gender       = tc(data.gender       || "");
    var relationship = data.relationship    || "Member";
    var father       = tc(data.father       || "");
    var mother       = tc(data.mother       || "");
    var spouse       = tc(data.spouse       || "");
    var children     = data.children        || "N/A";
    var siblings     = data.siblings        || "N/A";
    var emergency    = data.emergency       || "";
    var priorYN      = data.priorYN         || "No";
    var priorAmount  = parseFloat(data.priorAmount) || 0;
    var source       = data.source          || "custom-form";
    var enteredBy    = data.enteredBy       || "";

    // Basic validation
    if (!fullName || !email) {
      return jsonResponse({ status: "error", message: "Name and email required" });
    }

    // Email format check
    if (!/\S+@\S+\.\S+/.test(email)) {
      return jsonResponse({ status: "error", message: "Invalid email address" });
    }

    // ── BLOCKLIST CHECK ──────────────────────────────────────
    var blockResult = checkBlocklist(email, fullName);
    if (blockResult.blocked) {
      holdForReview(data, blockResult);
      return jsonResponse({
        status:  "review",
        message: "Your registration has been received and is under review. " +
                 "Leadership will be in touch shortly."
      });
    }

    // ── Write new row to MEMBERS sheet ──────────────────────
    // Columns match existing Google Form structure exactly:
    // A=Timestamp, B=Email, C=Name, D=Phone, E=Location,
    // F=Gender, G=Relationship, H=Father, I=Mother, J=Spouse,
    // K=Children, L=Siblings, M=Emergency, N=Agreement,
    // O=PriorYN, P=PriorAmount
    // Q=MemberID (assigned by onFormSubmit lock)
    // R=WelcomeSent

    var newRow = membersSheet.getLastRow() + 1;

    membersSheet.getRange(newRow, 1).setValue(now);
    membersSheet.getRange(newRow, 2).setValue(email);
    membersSheet.getRange(newRow, 3).setValue(fullName);
    membersSheet.getRange(newRow, 4).setValue(phone);
    membersSheet.getRange(newRow, 5).setValue(location);
    membersSheet.getRange(newRow, 6).setValue(gender);
    membersSheet.getRange(newRow, 7).setValue(relationship);
    membersSheet.getRange(newRow, 8).setValue(father);
    membersSheet.getRange(newRow, 9).setValue(mother);
    membersSheet.getRange(newRow, 10).setValue(spouse);
    membersSheet.getRange(newRow, 11).setValue(children);
    membersSheet.getRange(newRow, 12).setValue(siblings);
    membersSheet.getRange(newRow, 13).setValue(emergency);
    membersSheet.getRange(newRow, 14).setValue(
      enteredBy ? "I agree — Entered by " + enteredBy : "I agree — " + source);
    membersSheet.getRange(newRow, 15).setValue(priorYN);
    membersSheet.getRange(newRow, 16).setValue(priorAmount > 0 ? priorAmount : "");

    SpreadsheetApp.flush();

    // ── Trigger registration logic ───────────────────────────
    // Build a fake event object matching what onFormSubmit expects
    var fakeEvent = {
      range: membersSheet.getRange(newRow, 1)
    };

    // Run registration — assigns Member ID and sends welcome email
    onFormSubmit(fakeEvent);

    // ── Read back the assigned Member ID ────────────────────
    Utilities.sleep(1000);
    var memberId = membersSheet.getRange(newRow, 17).getValue() || "";

    logAction("doPost",
      "Web form registration: " + fullName + " (" + email + ")" +
      (memberId ? " → " + memberId : " — ID pending") +
      " | Source: " + source, "OK");

    return jsonResponse({
      status:   "success",
      memberId: memberId.toString(),
      name:     fullName,
      message:  "Registration received. Welcome email being sent to " + email
    });

  } catch(err) {
    Logger.log("doPost ERROR: " + err.toString());
    logAction("doPost", "Web form error", "ERROR", err.toString());
    return jsonResponse({
      status:  "error",
      message: "Registration failed: " + err.toString()
    });
  }
}

function doGet(e) {
  var params = e ? (e.parameter || {}) : {};
  var action = params.action || "";

  // ── Dashboard data endpoint ─────────────────────────────
  if (action === "dashboard") {
    var ss            = _mwGetSS();
    var membersSheet  = ss.getSheetByName("MEMBERS");
    var paymentsSheet = ss.getSheetByName("PAYMENTS");
    var fundsSheet    = ss.getSheetByName("FUNDS");
    var settingsSheet = ss.getSheetByName("SETTINGS");

    var cfg = {
      regFee    : parseFloat(settingsSheet.getRange("B1").getValue()) || 25,
      groupName : settingsSheet.getRange("B2").getValue(),
      zelleEmail: settingsSheet.getRange("B4").getValue(),
      leaderEmail: settingsSheet.getRange("B3").getValue()
    };

    var membersData  = membersSheet.getDataRange().getValues();
    var paymentsData = paymentsSheet.getDataRange().getValues();
    var fundsData    = fundsSheet ? fundsSheet.getDataRange().getValues() : [];

    var now      = new Date();
    var thisMonth = now.getMonth();
    var thisYear  = now.getFullYear();

    // Build payment totals per member
    var memberPayments = {}; // memberId -> { regPaid, regBalance, funeralPaid:{} }
    var totalCollected = 0, thisMonthCollected = 0;
    var recentPayments = [];

    for (var p = 1; p < paymentsData.length; p++) {
      var pid    = paymentsData[p][1] ? paymentsData[p][1].toString().trim().toUpperCase() : "";
      var pAmt   = parseFloat(paymentsData[p][3]) || 0;
      var pType  = paymentsData[p][4] ? paymentsData[p][4].toString() : "";
      var pStat  = paymentsData[p][10] ? paymentsData[p][10].toString().trim() : "";
      var pDate  = paymentsData[p][0] ? new Date(paymentsData[p][0]) : null;
      var pName  = paymentsData[p][2] ? paymentsData[p][2].toString() : "";
      var pFund  = paymentsData[p][6] ? paymentsData[p][6].toString() : "";

      if (!pid || pid === "UNMATCHED" || pid === "DISMISSED") continue;
      if (pStat === "UNMATCHED" || pStat === "REVERSED") continue;

      // Count toward total: CONFIRMED, SETTLED, DETECTED, NAME-MATCHED, MANUAL ENTRY
      // Exclude junk header rows, blank, UNMATCHED, REVERSED, DISMISSED, PENDING, SENDING
      var isConfirmed = pStat && pAmt > 0 &&
                        pStat !== "UNMATCHED" && pStat !== "REVERSED" &&
                        pStat !== "DISMISSED" && pStat !== "PENDING" &&
                        pStat !== "Status" && pStat !== "LAST PAYMENT" &&
                        pStat.indexOf("SENDING") === -1 &&
                        pStat.indexOf("GMT") === -1;
      if (isConfirmed && pAmt > 0) {
        totalCollected += pAmt;
        if (pDate && pDate.getMonth() === thisMonth && pDate.getFullYear() === thisYear) {
          thisMonthCollected += pAmt;
        }
        recentPayments.push({
            id: pid, name: pName, amount: pAmt, type: pType,
            date: pDate ? (pDate.getMonth()+1)+"/"+pDate.getDate()+"/"+pDate.getFullYear() : "",
            status: pStat, fund: pFund
          });
      }

      // Only map to member balances if there's a real member ID (not a dash/bulk row)
      if (pid && pid !== "—") {
        if (!memberPayments[pid]) memberPayments[pid] = { regPaid: 0, funds: {} };
        if (pType === "Registration Fee" && pStat !== "UNMATCHED") {
          memberPayments[pid].regPaid = (memberPayments[pid].regPaid || 0) + pAmt;
        }
        if (pType === "Funeral Contribution") {
          memberPayments[pid].funds[pFund] = (memberPayments[pid].funds[pFund] || 0) + pAmt;
        }
      }
    }

    // Build member list
    var members = [];
    var totalMembers = 0, paidCount = 0, partialCount = 0, unpaidCount = 0;
    var eligible = 0, atRisk = 0, ineligible = 0;

    for (var r = 1; r < membersData.length; r++) {
      var mId    = membersData[r][16] ? membersData[r][16].toString().trim() : "";
      var mName  = membersData[r][2]  ? membersData[r][2].toString()  : "";
      var mEmail = membersData[r][1]  ? membersData[r][1].toString()  : "";
      var mPhone = membersData[r][3]  ? membersData[r][3].toString()  : "";
      var mLoc   = membersData[r][4]  ? membersData[r][4].toString()  : "";
      var mPrior  = parseFloat(membersData[r][15]) || 0;
      var mCredS  = parseFloat(membersData[r][18]) || 0;
      if (!mId) continue;

      totalMembers++;

      var mp = memberPayments[mId] || { regPaid: 0, funds: {} };
      // Reg fee covered by: live reg payments + prior contribution (col P) + redirected funeral credit (col S)
      // Col S = real money from cancelled Kachingwe fund redirected to reg fee
      var regCashLive = mp.regPaid || 0;
      var totalReg    = regCashLive + mPrior + mCredS;
      var regBal      = Math.max(0, cfg.regFee - totalReg);
      var regStatus   = totalReg >= cfg.regFee ? "PAID" : (totalReg > 0 ? "PARTIAL" : "UNPAID");

      if (regStatus === "PAID") paidCount++;
      else if (regStatus === "PARTIAL") partialCount++;
      else unpaidCount++;

      // Eligibility: must have reg fee paid
      var isEligible = regStatus === "PAID";
      var isAtRisk   = regStatus === "PARTIAL";
      if (isEligible) eligible++;
      else if (isAtRisk) atRisk++;
      else ineligible++;

      members.push({
        id: mId, name: mName, email: mEmail, phone: mPhone, location: mLoc,
        regStatus: regStatus, regBalance: regBal, regPaid: Math.min(totalReg, cfg.regFee),
        credit: mPrior + mCredS, eligible: isEligible, atRisk: isAtRisk
      });
    }

    // Sort: unpaid first, then partial, then paid
    members.sort(function(a, b) {
      var order = { UNPAID: 0, PARTIAL: 1, PAID: 2 };
      return (order[a.regStatus] || 0) - (order[b.regStatus] || 0);
    });

    // Active funds
    var activeFunds = [];
    for (var f = 1; f < fundsData.length; f++) {
      if (!fundsData[f][0] || fundsData[f][8] !== "ACTIVE") continue;
      activeFunds.push({
        code: fundsData[f][0].toString(),
        name: fundsData[f][1].toString(),
        deceased: fundsData[f][2].toString(),
        amount: parseFloat(fundsData[f][4]) || 10,
        collected: parseFloat(fundsData[f][7]) || 0,
        deadline: fundsData[f][9] ? new Date(fundsData[f][9]).toLocaleDateString() : ""
      });
    }

    // Funeral capacity projection ($3000 advance)
    var ADVANCE = 3000;
    var capacity = totalCollected > 0 ? Math.floor(totalCollected / ADVANCE) : 0;

    var dashData = {
      status: "ok",
      updated: now.toString(),
      groupName: cfg.groupName,
      zelleEmail: cfg.zelleEmail,
      regFee: cfg.regFee,
      totalMembers: totalMembers,
      paidCount: paidCount,
      partialCount: partialCount,
      unpaidCount: unpaidCount,
      eligible: eligible,
      atRisk: atRisk,
      ineligible: ineligible,
      totalCollected: totalCollected,
      thisMonthCollected: thisMonthCollected,
      activeFunds: activeFunds,
      capacity: capacity,
      members: members,
      recentPayments: recentPayments.slice(-10).reverse()
    };

    return jsonpResponse(dashData, params.callback || "");
  }

  // ── Send individual reminder ────────────────────────────
  if (action === "remind") {
    var memberId = (params.memberId || "").toString().trim().toUpperCase();
    if (!memberId) return jsonpResponse({ status:"error", message:"No memberId" }, params.callback || "");
    var ss2 = _mwGetSS(), cfg2 = _mwGetCfg(ss2);
    var membersSheet2 = ss2.getSheetByName("MEMBERS");
    var paymentsSheet2 = ss2.getSheetByName("PAYMENTS");
    var mData = membersSheet2.getDataRange().getValues();
    var pData2 = paymentsSheet2.getDataRange().getValues();

    for (var mr = 1; mr < mData.length; mr++) {
      var mId2 = mData[mr][16] ? mData[mr][16].toString().trim().toUpperCase() : "";
      if (mId2 !== memberId) continue;

      var mName2  = mData[mr][2] ? mData[mr][2].toString() : "";
      var mEmail2 = mData[mr][1] ? mData[mr][1].toString() : "";
      var mFirst2 = mName2.split(" ")[0];
      var mPrior2 = parseFloat(mData[mr][15]) || 0;

      // Calculate live balance from payments
      var totalPaid2 = 0;
      var pHistHtml = "";
      var pCount2 = 0;
      for (var phi2 = pData2.length - 1; phi2 >= 1; phi2--) {
        var phId2 = pData2[phi2][1] ? pData2[phi2][1].toString().trim() : "";
        if (!phId2 || phId2.toUpperCase().indexOf(memberId) === -1 || phId2.indexOf("REVERSED") !== -1) continue;
        var phAmt2  = parseFloat(pData2[phi2][3]) || 0;
        var phType2 = pData2[phi2][4] ? pData2[phi2][4].toString() : "";
        var phStat2 = pData2[phi2][10] ? pData2[phi2][10].toString() : "";
        var phDate2 = pData2[phi2][0] ? new Date(pData2[phi2][0]) : null;
        if (phStat2 === "UNMATCHED") continue;
        if (phType2 === "Registration Fee") totalPaid2 += phAmt2;
        if (pCount2 < 8) {
          var phDs2 = phDate2 ? (phDate2.getMonth()+1)+"/"+phDate2.getDate()+"/"+phDate2.getFullYear() : "";
          pHistHtml += "<tr style='background:" + (pCount2%2===0?"#f7fbf3":"#fff") + ";'>" +
            "<td style='padding:7px 12px;font-size:12px;color:#555;border-bottom:1px solid #eee;'>" + phDs2 + "</td>" +
            "<td style='padding:7px 12px;font-size:12px;color:#1a1a1a;border-bottom:1px solid #eee;'>" + phType2 + "</td>" +
            "<td style='padding:7px 12px;font-size:12px;font-weight:700;color:#217B31;border-bottom:1px solid #eee;text-align:right;'>+$" + phAmt2 + "</td></tr>";
          pCount2++;
        }
      }

      var mCredS2   = parseFloat(mData[mr][18]) || 0;
      var balance2  = Math.max(0, cfg2.regFee - totalPaid2 - mPrior2 - mCredS2);
      var isMember2 = (totalPaid2 + mPrior2 + mCredS2) >= cfg2.regFee;
      // Never send reminder if fully covered (cash + prior + redirected funeral credit)
      if (balance2 <= 0) return jsonpResponse({ status:"ok", message:"No reminder needed — fully paid" }, params.callback || "");
      if (!mEmail2) return jsonpResponse({ status:"ok", message:"No email on file" }, params.callback || "");

      // Eligibility
      var joinDate2 = mData[mr][0] ? new Date(mData[mr][0]) : null;
      var daysSince2 = joinDate2 ? Math.floor((new Date()-joinDate2)/86400000) : 0;
      var foundingOk2 = joinDate2 && joinDate2 <= new Date("2026-04-30T23:59:59");
      var isElig2 = isMember2 && (foundingOk2 || daysSince2 >= 120);
      var N2 = "#0a1a2e", G2 = "#217B31", R2 = "#D52321", GOLD2 = "#D68B0C";
      var eligColor2 = isElig2 ? G2 : R2;
      var eligText2  = !isMember2
        ? "Not yet a member — registration fee not fully paid"
        : (!foundingOk2 && daysSince2 < 120 ? "Waiting period — " + (120-daysSince2) + " days remaining" : "Fully eligible");

      var htmlBody2 =
        "<div style='margin:0;padding:20px 0;background:#f0ece4;font-family:Arial,sans-serif;'>" +
        "<div style='max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #ddd;'>" +
        "<div style='height:5px;display:flex;'><div style='flex:1;background:" + R2 + ";'></div><div style='flex:1;background:" + G2 + ";'></div><div style='flex:1;background:#1a3a5e;'></div></div>" +
        "<div style='background:" + N2 + ";padding:22px 24px;text-align:center;border-bottom:3px solid " + R2 + ";'>" +
        "<img src='https://lh3.googleusercontent.com/d/1S3eEVjZY5yTfOXadnZfYU-1xbWGrykeP' style='width:56px;height:56px;border-radius:50%;border:2px solid " + R2 + ";display:block;margin:0 auto 10px;'/>" +
        "<p style='color:#fff;font-size:17px;font-weight:700;letter-spacing:2px;margin:0;font-family:Georgia,serif;'>MGWIRIZANO WATSOPANO</p>" +
        "<p style='color:#a8d880;font-size:10px;letter-spacing:3px;text-transform:uppercase;margin:4px 0 0;'>Registration Fee Reminder</p></div>" +
        "<div style='padding:24px;'>" +
        "<p style='font-size:15px;color:#1a1a1a;margin:0 0 16px;'>Dear <strong>" + mFirst2 + "</strong>,</p>" +
        (balance2 > 0 ?
          "<div style='background:#fff3f3;border:2px solid " + R2 + ";border-radius:10px;padding:18px 20px;text-align:center;margin-bottom:16px;'>" +
          "<p style='margin:0 0 4px;color:" + R2 + ";font-size:11px;letter-spacing:3px;text-transform:uppercase;font-weight:700;'>Outstanding Balance</p>" +
          "<p style='margin:4px 0;font-size:42px;font-weight:700;color:#7a1010;font-family:Georgia,serif;'>$" + balance2 + "</p>" +
          "<p style='margin:6px 0 0;font-size:13px;color:#555;'>Send via Zelle &nbsp;·&nbsp; Memo: <strong style='letter-spacing:1px;'>" + memberId + " Registration Fee</strong></p></div>" +
          "<div style='background:#fff8e1;border-left:4px solid " + GOLD2 + ";padding:14px 16px;border-radius:0 8px 8px 0;margin-bottom:16px;'>" +
          "<p style='margin:0;font-size:13px;color:#7a5010;line-height:1.7;'><strong>⚠ Courtesy Notice:</strong> Your membership is <strong>not fully active</strong> until the $" + cfg2.regFee + " registration fee is paid in full. Until then, you and your declared beneficiaries <strong>do not qualify for funeral fund coverage</strong>. Please complete your payment at your earliest convenience.</p></div>"
        :
          "<div style='background:#eaf5ed;border:2px solid " + G2 + ";border-radius:10px;padding:14px 20px;text-align:center;margin-bottom:16px;'>" +
          "<p style='margin:0;font-size:15px;font-weight:700;color:#0d4a1a;'>✓ Registration fee fully paid</p></div>"
        ) +
        "<table style='width:100%;border-collapse:collapse;margin-bottom:20px;'>" +
        "<tr><td style='padding:9px 12px;color:#666;font-size:12px;border-bottom:1px solid #eee;width:140px;'>Member ID</td>" +
        "<td style='padding:9px 12px;font-weight:700;color:" + N2 + ";font-family:monospace;font-size:15px;border-bottom:1px solid #eee;'>" + memberId + "</td></tr>" +
        "<tr style='background:#f7fbf3;'><td style='padding:9px 12px;color:#666;font-size:12px;border-bottom:1px solid #eee;'>Eligibility</td>" +
        "<td style='padding:9px 12px;font-weight:700;color:" + eligColor2 + ";font-size:13px;border-bottom:1px solid #eee;'>" + eligText2 + "</td></tr>" +
        "<tr><td style='padding:9px 12px;color:#666;font-size:12px;border-bottom:1px solid #eee;'>Total paid</td>" +
        "<td style='padding:9px 12px;font-weight:600;color:" + G2 + ";border-bottom:1px solid #eee;'>$" + (totalPaid2 + mPrior2) + " of $" + cfg2.regFee + "</td></tr>" +
        (balance2 > 0 ? "<tr style='background:#fff3f3;'><td style='padding:9px 12px;color:#666;font-size:12px;'>Balance due</td><td style='padding:9px 12px;font-weight:700;color:" + R2 + ";'>$" + balance2 + "</td></tr>" : "") +
        "</table>" +
        (pCount2 > 0 ?
          "<p style='font-size:11px;font-weight:700;color:#666;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px;border-bottom:2px solid " + G2 + ";padding-bottom:6px;'>Your Payment History</p>" +
          "<table style='width:100%;border-collapse:collapse;margin-bottom:20px;'>" +
          "<tr style='background:" + N2 + ";'><th style='padding:8px 12px;color:#fff;text-align:left;font-size:11px;'>Date</th><th style='padding:8px 12px;color:#fff;text-align:left;font-size:11px;'>Type</th><th style='padding:8px 12px;color:#fff;text-align:right;font-size:11px;'>Amount</th></tr>" +
          pHistHtml + "</table>" : "") +
        "</div>" +
        "<div style='background:" + N2 + ";padding:16px 24px;text-align:center;border-top:3px solid " + R2 + ";'>" +
        "<p style='margin:0 0 4px;color:#fff;font-size:13px;font-family:Georgia,serif;'>Questions? Contact leadership</p>" +
        "<p style='margin:0;font-size:11px;color:#4a6a8a;'>" + cfg2.leaderEmail + "</p></div>" +
        "<div style='height:5px;display:flex;'><div style='flex:1;background:" + G2 + ";'></div><div style='flex:1;background:" + R2 + ";'></div><div style='flex:1;background:" + GOLD2 + ";'></div></div>" +
        "</div></div>";

      var subject2 = balance2 > 0
        ? "Action Required: $" + balance2 + " outstanding — " + cfg2.groupName
        : "Your Membership Status — " + cfg2.groupName;

      var plain2 = "Dear " + mFirst2 + ", your registration fee balance is $" + balance2 + ". Member ID: " + memberId + ". Eligibility: " + eligText2 + ". Zelle: " + cfg2.zelleEmail + " | Memo: " + memberId + " Registration Fee.";

      _mwSendEmail(mEmail2, subject2, plain2,
        { htmlBody: htmlBody2, name: cfg2.groupName, replyTo: cfg2.leaderEmail });
      _mwLog("remind", "HTML reminder sent to " + mName2 + " (" + memberId + ")", "OK");
      return jsonpResponse({ status:"ok", message:"Reminder sent to " + mEmail2 }, params.callback || "");
    }
    return jsonpResponse({ status:"error", message:"Member not found" }, params.callback || "");
  }

  // ── Member verify lookup ────────────────────────────────
  if (action === "verify") {
    var query = (params.query || "").toString().trim().toLowerCase();
    if (!query) return jsonResponse({ status: "error", message: "No query" });

    var ss           = _mwGetSS();
    var membersSheet = ss.getSheetByName("MEMBERS");
    var paymentsSheet = ss.getSheetByName("PAYMENTS");
    if (!membersSheet) return jsonResponse({ status: "error", message: "Sheet not found" });

    var data    = membersSheet.getDataRange().getValues();
    var matches = [];
    var isMWId  = /^mw\d{4}$/.test(query);

    for (var r = 1; r < data.length; r++) {
      var rowId    = data[r][16] ? data[r][16].toString().trim() : "";
      var rowEmail = data[r][1]  ? data[r][1].toString().trim().toLowerCase() : "";
      var rowName  = data[r][2]  ? data[r][2].toString().trim().toLowerCase() : "";
      var regPaid  = data[r][19] ? data[r][19].toString().trim() : "";
      var welcomeSent = data[r][17] ? data[r][17].toString().trim() : "";

      if (!rowId) continue;

      var match = false;
      if (isMWId && rowId.toLowerCase() === query) match = true;
      if (!isMWId && rowEmail === query) match = true;
      if (!isMWId && rowName.indexOf(query) !== -1) match = true;

      if (match) {
        // Get balance from PAYMENTS sheet
        var balance = 25;
        if (paymentsSheet) {
          var pData = paymentsSheet.getDataRange().getValues();
          var totalPaid = 0;
          for (var p = 1; p < pData.length; p++) {
            if (!pData[p][1]) continue;
            if (pData[p][1].toString().toUpperCase() !== rowId.toUpperCase()) continue;
            if ((pData[p][4]||"").toString() === "Registration Fee") {
              totalPaid += parseFloat(pData[p][3]) || 0;
            }
          }
          balance = Math.max(0, 25 - totalPaid);
        }

        matches.push({
          memberId:    rowId,
          name:        data[r][2] ? data[r][2].toString() : "",
          email:       data[r][1] ? data[r][1].toString() : "",
          phone:       data[r][3] ? data[r][3].toString() : "",
          location:    data[r][4] ? data[r][4].toString() : "",
          regPaid:     regPaid,
          welcomeSent: welcomeSent,
          balance:     balance,
          fullyPaid:   /^YES/i.test(regPaid),
          status:      /^YES/i.test(regPaid) ? "PAID" :
                       /^PARTIAL/i.test(regPaid) ? "PARTIAL" : "UNPAID"
        });
      }
    }

    var cb2 = params.callback || "";
    return jsonpResponse({
      status:  "ok",
      query:   query,
      count:   matches.length,
      members: matches
    }, cb2);
  }

  // ── Member detail ──────────────────────────────────────
  if (action === "member_detail") {
    var cbMD = params.callback || "";
    var mId  = (params.memberId || "").toString().trim().toUpperCase();
    if (!mId) return jsonpResponse({status:"error",message:"No memberId"}, cbMD);

    var ssMD  = _mwGetSS();
    var cfgMD = _mwGetCfg(ssMD);
    var memSh = ssMD.getSheetByName("MEMBERS");
    var paysh = ssMD.getSheetByName("PAYMENTS");
    var funsh = ssMD.getSheetByName("FUNDS");
    var mRows = memSh.getDataRange().getValues();
    var mRow  = null, mIdx = -1;
    for (var mr = 1; mr < mRows.length; mr++) {
      if (mRows[mr][16] && mRows[mr][16].toString().trim().toUpperCase() === mId) {
        mRow = mRows[mr]; mIdx = mr; break;
      }
    }
    if (!mRow) return jsonpResponse({status:"error",message:"Member not found"}, cbMD);

    var pRows = paysh ? paysh.getDataRange().getValues() : [];
    var payments = [], regCash = 0, funCash = 0;
    for (var pr = 1; pr < pRows.length; pr++) {
      var pid = pRows[pr][1] ? pRows[pr][1].toString().trim() : "";
      if (!pid || pid.toUpperCase().indexOf(mId) === -1) continue;
      if (pid.indexOf("REVERSED") !== -1) continue;
      var pAmt  = parseFloat(pRows[pr][3]) || 0;
      var pType = pRows[pr][4] ? pRows[pr][4].toString() : "";
      var pFund = pRows[pr][6] ? pRows[pr][6].toString() : "";
      var pDate = pRows[pr][0] ? new Date(pRows[pr][0]) : null;
      var pStat = pRows[pr][10] ? pRows[pr][10].toString().trim() : "";
      if (pStat === "UNMATCHED") continue;
      payments.push({
        date:   pDate ? (pDate.getMonth()+1)+"/"+pDate.getDate()+"/"+pDate.getFullYear() : "",
        amount: pAmt, type: pType,
        fund:   pFund || pType,
        status: pStat,
        memo:   pRows[pr][8] ? pRows[pr][8].toString() : ""
      });
      if (pType === "Registration Fee") regCash += pAmt;
      if (pType === "Funeral Contribution") funCash += pAmt;
    }
    payments.reverse();

    var prior    = parseFloat(mRow[15]) || 0;
    var storedFC = parseFloat(mRow[18]) || 0;
    // Reg fee covered by: live reg payments + prior contribution (col P) + redirected funeral credit (col S)
    var totalCov = regCash + prior + storedFC;
    var regBal   = Math.max(0, cfgMD.regFee - totalCov);
    var regStat  = totalCov >= cfgMD.regFee ? "PAID" : (totalCov > 0 ? "PARTIAL" : "UNPAID");
    // Funeral credit shown separately = any excess above reg fee
    var fcred    = Math.max(0, totalCov - cfgMD.regFee);
    var joinDate = mRow[0] ? new Date(mRow[0]) : null;
    var joinStr  = joinDate ? (joinDate.getMonth()+1)+"/"+joinDate.getDate()+"/"+joinDate.getFullYear() : "";
    var daysSince= joinDate ? Math.floor((new Date()-joinDate)/86400000) : 0;
    // Founding members (joined on or before Apr 30 2026) skip 120-day waiting period
    var foundingCutoff = new Date("2026-04-30T23:59:59");
    var isFounding = joinDate && joinDate <= foundingCutoff;
    var waiting  = !isFounding && daysSince < 120 && regStat === "PAID";

    var funds = [];
    if (funsh) {
      var fRows = funsh.getDataRange().getValues();
      for (var ff = 1; ff < fRows.length; ff++) {
        if (!fRows[ff][0] || fRows[ff][8] !== "ACTIVE") continue;
        var fc   = fRows[ff][0].toString();
        var fAmt = parseFloat(fRows[ff][4]) || 10;
        var fDL  = fRows[ff][9] ? new Date(fRows[ff][9]).toLocaleDateString() : "";
        var fEx  = fRows[ff][6] ? fRows[ff][6].toString() : "";
        if (fEx.toUpperCase().indexOf(mId) !== -1) {
          funds.push({fund:fc,status:"EXEMPT",owed:0,paid:0,balance:0,deadline:fDL}); continue;
        }
        var fpaid = 0;
        for (var fp = 0; fp < payments.length; fp++) {
          if (payments[fp].fund && payments[fp].fund.toUpperCase().indexOf(fc.toUpperCase()) !== -1)
            fpaid += payments[fp].amount;
        }
        var fbal = Math.max(0, fAmt - fpaid - fcred);
        funds.push({fund:fc,status:fbal<=0?"PAID":"PENDING",owed:fAmt,paid:fpaid,balance:fbal,deadline:fDL});
      }
    }

    return jsonpResponse({
      status:"ok", memberId:mId,
      name:     mRow[2] ? mRow[2].toString() : "",
      email:    mRow[1] ? mRow[1].toString() : "",
      phone:    mRow[3] ? mRow[3].toString() : "",
      location: mRow[4] ? mRow[4].toString() : "",
      gender:   mRow[5] ? mRow[5].toString() : "",
      joinDate: joinStr, daysSinceJoin: daysSince,
      regFee: cfgMD.regFee, regPaidCash: regCash,
      priorContrib: prior, funeralCredit: fcred,
      totalCredit: prior + fcred,
      totalRegCovered: totalCov, regBalance: regBal, regStatus: regStat,
      fullyEligible: regStat==="PAID" && !waiting,
      inWaitingPeriod: waiting, daysRemaining120: Math.max(0,120-daysSince),
      payments: payments, paymentCount: payments.length,
      totalPaid: regCash + funCash, activeFunds: funds,
      fatherName:  mRow[7]  ? mRow[7].toString()  : "",
      motherName:  mRow[8]  ? mRow[8].toString()  : "",
      spouse:      mRow[9]  ? mRow[9].toString()  : "",
      children:    mRow[10] ? mRow[10].toString() : "",
      siblings:    mRow[11] ? mRow[11].toString() : ""
    }, cbMD);
  }

    // ── Resend confirmation email (member self-serve) ──────
  if (action === "resend_email") {
    var cbR = params.callback || "";
    var mIdR = (params.memberId || "").toString().trim().toUpperCase();
    if (!mIdR) return jsonpResponse({ status:"error", message:"No memberId" }, cbR);
    var ssR = _mwGetSS(), cfgR = _mwGetCfg(ssR);
    var memShR = ssR.getSheetByName("MEMBERS");
    var mRowsR = memShR.getDataRange().getValues();
    for (var rr = 1; rr < mRowsR.length; rr++) {
      if (!mRowsR[rr][16] || mRowsR[rr][16].toString().trim().toUpperCase() !== mIdR) continue;
      var mEmailR = mRowsR[rr][1] ? mRowsR[rr][1].toString().trim() : "";
      var mNameR  = mRowsR[rr][2] ? mRowsR[rr][2].toString().trim() : "";
      if (!mEmailR) return jsonpResponse({ status:"error", message:"No email on file for this member." }, cbR);
      var typeR2  = (params.type || "welcome").toString().trim().toLowerCase();
      // Separate rate limit per type, 5 minutes
      var rateKey = "RESEND_" + mIdR + "_" + typeR2;
      var lastR = PropertiesService.getScriptProperties().getProperty(rateKey);
      if (lastR && (Date.now() - parseInt(lastR)) < 5 * 60 * 1000) {
        var waitSecs = Math.ceil((5*60*1000-(Date.now()-parseInt(lastR)))/60000);
        return jsonpResponse({ status:"throttled", message:"Email already resent recently. Wait " + waitSecs + " more minute(s) then try again." }, cbR);
      }
      try {
        var typeR   = typeR2;
        var priorR  = parseFloat(mRowsR[rr][15]) || 0;
        var credSR  = parseFloat(mRowsR[rr][18]) || 0;
        // Get live payments
        var payShR  = ssR.getSheetByName("PAYMENTS");
        var payRowsR = payShR ? payShR.getDataRange().getValues() : [];
        var cashR = 0, lastPayR = null, lastAmtR = 0;
        for (var prIdx = payRowsR.length-1; prIdx >= 1; prIdx--) {
          var prPid = payRowsR[prIdx][1] ? payRowsR[prIdx][1].toString().trim().toUpperCase() : "";
          if (prPid !== mIdR) continue;
          var prAmt = parseFloat(payRowsR[prIdx][3]) || 0;
          var prType = payRowsR[prIdx][4] ? payRowsR[prIdx][4].toString() : "";
          var prStat = payRowsR[prIdx][10] ? payRowsR[prIdx][10].toString() : "";
          if (prStat === "UNMATCHED" || prStat === "REVERSED") continue;
          if (prType === "Registration Fee") cashR += prAmt;
          if (!lastPayR && prAmt > 0) { lastPayR = payRowsR[prIdx][0]; lastAmtR = prAmt; }
        }
        var balR = Math.max(0, cfgR.regFee - cashR - priorR - credSR);
        var N2="0a1a2e", G2="#217B31", R2="#D52321", GOLD2="#D68B0C";

        var subjR, htmlR, plainR;

        if (typeR === "payment" && lastPayR) {
          // Call the same buildConfirmEmail function used by the payment scanner
          subjR  = "Payment Confirmed — " + cfgR.groupName + " | " + mIdR + " | REG";
          var lastPayType = "Registration Fee";
          var lastFundCode = "REG";
          htmlR  = buildConfirmEmail(cfgR, mNameR, mIdR, lastAmtR,
            lastPayType, lastPayType, lastFundCode, balR, 0, lastPayR);
          plainR = "Dear " + mNameR.split(" ")[0] + ", your payment of $" + lastAmtR +
            " has been received. Member ID: " + mIdR +
            ". Balance: " + (balR<=0?"Fully Paid":"$"+balR+" remaining") + ".";
        } else {
          // Welcome resend — use resendWelcomeEmail pattern (does NOT re-run registration)
          try {
            var wSettR  = ssR.getSheetByName("SETTINGS");
            var bylawsR = wSettR ? wSettR.getRange("B5").getValue() : "";
            var benefR  = wSettR ? wSettR.getRange("B22").getValue() : "";
            var wPriorR = parseFloat(mRowsR[rr][15]) || 0;
            var wCredR  = parseFloat(mRowsR[rr][18]) || 0;
            var wBalR   = Math.max(0, cfgR.regFee - wPriorR - wCredR);
            var wSubj   = "Welcome to " + cfgR.groupName + " — Your Member ID: " + mIdR;
            var wHtml   = buildHtmlEmail(
              { GREEN:"#217B31", RED:"#D52321", NAVY:"#0a1a2e", GOLD:"#D68B0C",
                logoUrl:"https://lh3.googleusercontent.com/d/1S3eEVjZY5yTfOXadnZfYU-1xbWGrykeP",
                groupName: cfgR.groupName },
              "success", "Official Membership Confirmation",
              [["Member ID", mIdR],
               ["Name", mNameR],
               ["Amount Due", wBalR > 0 ? "$" + wBalR : "Fully covered"],
               ["Zelle to", cfgR.zelleEmail],
               ["Memo", mIdR + " Registration Fee"],
               ["Constitution", bylawsR || "Check WhatsApp for link"],
               ["Beneficiary Form", benefR || "Check WhatsApp for link"]],
              wBalR > 0
                ? "Please send $" + wBalR + " via Zelle to " + cfgR.zelleEmail + ". Always include your Member ID in the memo."
                : "Your registration fee is fully covered. No payment needed.",
              null
            );
            var wPlain  = "Dear " + mNameR.split(" ")[0] + ", your Member ID is: " + mIdR +
              (wBalR > 0 ? ". Amount due: $" + wBalR + ". Zelle to: " + cfgR.zelleEmail + " | Memo: " + mIdR + " Registration Fee." : ". Your registration fee is fully covered.");
            _mwSendEmail(mEmailR, wSubj, wPlain,
              { htmlBody: wHtml, name: cfgR.groupName, replyTo: cfgR.leaderEmail });
          } catch(welErr) {
            _mwLog("resend_email", "Welcome resend error: " + welErr.toString(), "ERROR");
            return jsonpResponse({ status:"error", message:"Failed to resend. Try again later." }, cbR);
          }
          PropertiesService.getScriptProperties().setProperty(rateKey, Date.now().toString());
          memShR.getRange(rr+1, 18).setValue("RESENT — " + new Date().toLocaleDateString());
          _mwLog("resend_email", "Welcome resent to " + mIdR, "OK");
          return jsonpResponse({ status:"ok", message:"Email resent to " + mEmailR + ". Check your inbox and spam folder.", email: mEmailR }, cbR);
        }

        _mwSendEmail(mEmailR, subjR, plainR, { htmlBody: htmlR, name: cfgR.groupName, replyTo: cfgR.leaderEmail });
        memShR.getRange(rr+1, 18).setValue("RESENT — " + new Date().toLocaleDateString());
        PropertiesService.getScriptProperties().setProperty(rateKey, Date.now().toString());
        _mwLog("resend_email", "Welcome resent to " + mIdR, "OK");
        return jsonpResponse({ status:"ok", message:"Email resent to " + mEmailR + ". Check your inbox and spam folder.", email: mEmailR }, cbR);
      } catch(eR) {
        return jsonpResponse({ status:"error", message:"Failed to send. Please try again later." }, cbR);
      }
    }
    return jsonpResponse({ status:"error", message:"Member ID " + mIdR + " not found." }, cbR);
  }

    // ── Get verification question ──────────────────────────
  // ?action=get_question&memberId=MW0001&callback=cb
  // Returns a random question based on member's own data. Never returns the answer.
  if (action === "get_question") {
    var cbQ = params.callback || "";
    var mIdQ = (params.memberId || "").toString().trim().toUpperCase();
    if (!mIdQ) return jsonpResponse({ status:"error", message:"No memberId" }, cbQ);

    // Rate limit: max 5 attempts per member per 10 minutes
    var attemptKey = "QATTEMPT_" + mIdQ;
    var attemptData = PropertiesService.getScriptProperties().getProperty(attemptKey);
    var attempts = 0, lastAttemptTime = 0;
    if (attemptData) {
      try { var ad = JSON.parse(attemptData); attempts = ad.n || 0; lastAttemptTime = ad.t || 0; } catch(e){}
    }
    // Reset counter if last attempt was more than 10 minutes ago
    if (Date.now() - lastAttemptTime > 10 * 60 * 1000) attempts = 0;
    if (attempts >= 5) {
      var waitMins = Math.ceil((10 * 60 * 1000 - (Date.now() - lastAttemptTime)) / 60000);
      return jsonpResponse({ status:"locked", message:"Too many attempts. Please try again in " + waitMins + " minutes." }, cbQ);
    }

    var ssQ = _mwGetSS();
    var memQ = ssQ.getSheetByName("MEMBERS").getDataRange().getValues();
    var mRowQ = null;
    for (var rq = 1; rq < memQ.length; rq++) {
      if (memQ[rq][16] && memQ[rq][16].toString().trim().toUpperCase() === mIdQ) { mRowQ = memQ[rq]; break; }
    }
    if (!mRowQ) {
      // Don't reveal if ID exists — just say we couldn't generate a question
      return jsonpResponse({ status:"error", message:"Could not generate a verification question for this ID." }, cbQ);
    }

    // Build pool of possible questions from member's actual data
    function firstWord(str) {
      if (!str) return "";
      // Strip relationship descriptions, get first word only
      var s = str.toString().trim()
        .replace(/\s*(full|step|half|\(same|\(different).*$/i, "")
        .trim();
      return s.split(/\s+/)[0] || "";
    }

    function lastFour(phone) {
      var d = (phone||"").toString().replace(/\D/g,"");
      return d.length >= 4 ? d.slice(-4) : "";
    }

    function cityOnly(loc) {
      if (!loc) return "";
      return loc.toString().split(",")[0].trim().split(" ")[0];
    }

    function splitNames(val) {
      if (!val) return [];
      var v = val.toString().trim();
      if (!v || v.toLowerCase()==="n/a" || v.toLowerCase()==="none") return [];
      return v.split(/\n|[,;]|\d+\.\s+/).map(function(p){
        return firstWord(p.replace(/\s*(full|step|half|\().*$/i,"").trim());
      }).filter(function(n){return n && n.length > 1;});
    }

    var questions = [];

    // Phone last 4
    var l4 = lastFour(mRowQ[3]);
    if (l4) questions.push({ q: "What are the last 4 digits of the phone number you registered with?", a: l4, type:"phone" });

    // Email
    var email = mRowQ[1] ? mRowQ[1].toString().trim().toLowerCase() : "";
    if (email) questions.push({ q: "What is the email address you used to register?", a: email, type:"email" });

    // Spouse first name
    var spouseFirst = firstWord(mRowQ[9]);
    if (spouseFirst && spouseFirst.length > 1) questions.push({ q: "What is your spouse's first name?", a: spouseFirst.toLowerCase(), type:"spouse" });

    // Child first name (pick one)
    var kids = splitNames(mRowQ[10]);
    if (kids.length > 0) questions.push({ q: "What is the first name of one of your children?", a: kids.map(function(k){return k.toLowerCase();}), type:"child" });

    // Sibling first name (pick one)
    var sibs = splitNames(mRowQ[11]);
    if (sibs.length > 0) questions.push({ q: "What is the first name of one of your siblings?", a: sibs.map(function(s){return s.toLowerCase();}), type:"sibling" });

    // City
    var city = cityOnly(mRowQ[4]);
    if (city && city.length > 2) questions.push({ q: "What city did you list as your location when you registered?", a: city.toLowerCase(), type:"city" });

    if (questions.length === 0) {
      // Fallback: ask for email (always available)
      return jsonpResponse({ status:"error", message:"Could not generate a verification question. Please contact leadership." }, cbQ);
    }

    // Pick a random question
    var chosen = questions[Math.floor(Math.random() * questions.length)];

    // Store answer + expiry in Script Properties (5 minute window)
    var token = Utilities.getUuid().replace(/-/g,"").substring(0,16);
    var tokenKey = "QTOKEN_" + mIdQ + "_" + token;
    PropertiesService.getScriptProperties().setProperty(tokenKey, JSON.stringify({
      answer: chosen.a,
      expires: Date.now() + 5 * 60 * 1000,
      memberId: mIdQ
    }));

    // Update attempt counter
    PropertiesService.getScriptProperties().setProperty(attemptKey,
      JSON.stringify({ n: attempts + 1, t: Date.now() }));

    return jsonpResponse({ status:"ok", question: chosen.q, token: token }, cbQ);
  }

  // ── Verify answer and return member data ────────────────
  // ?action=verify_answer&memberId=MW0001&token=abc&answer=Frank&callback=cb
  if (action === "verify_answer") {
    var cbA = params.callback || "";
    var mIdA    = (params.memberId || "").toString().trim().toUpperCase();
    var tokenA  = (params.token    || "").toString().trim();
    var answerA = (params.answer   || "").toString().trim().toLowerCase();
    if (!mIdA || !tokenA || !answerA) return jsonpResponse({ status:"error", message:"Missing parameters" }, cbA);

    var tokenKeyA = "QTOKEN_" + mIdA + "_" + tokenA;
    var storedA = PropertiesService.getScriptProperties().getProperty(tokenKeyA);
    if (!storedA) return jsonpResponse({ status:"error", message:"Verification session expired. Please request a new question." }, cbA);

    var storedObj;
    try { storedObj = JSON.parse(storedA); } catch(e) { return jsonpResponse({ status:"error", message:"Invalid session." }, cbA); }

    // Check expiry
    if (Date.now() > storedObj.expires) {
      PropertiesService.getScriptProperties().deleteProperty(tokenKeyA);
      return jsonpResponse({ status:"error", message:"Verification session expired. Please request a new question." }, cbA);
    }

    // Check answer — case insensitive, strip spaces
    var correct = false;
    var cleanAnswer = answerA.replace(/\s+/g,"").toLowerCase();
    var storedAnswers = Array.isArray(storedObj.answer) ? storedObj.answer : [storedObj.answer];
    for (var ai = 0; ai < storedAnswers.length; ai++) {
      if (storedAnswers[ai].replace(/\s+/g,"").toLowerCase() === cleanAnswer) { correct = true; break; }
    }

    if (!correct) {
      // Wrong answer — delete token so they can't retry with same token
      PropertiesService.getScriptProperties().deleteProperty(tokenKeyA);
      return jsonpResponse({ status:"wrong", message:"Incorrect answer. Please request a new question." }, cbA);
    }

    // Correct! Delete token (one-time use) and return full member data
    PropertiesService.getScriptProperties().deleteProperty(tokenKeyA);
    // Reset attempt counter on success
    PropertiesService.getScriptProperties().deleteProperty("QATTEMPT_" + mIdA);

    // Return full member detail
    var ssA = _mwGetSS(), cfgA = _mwGetCfg(ssA);
    var memShA = ssA.getSheetByName("MEMBERS");
    var payshA = ssA.getSheetByName("PAYMENTS");
    var funshA = ssA.getSheetByName("FUNDS");
    var mRowsA = memShA.getDataRange().getValues();
    var mRowA  = null;
    for (var ra = 1; ra < mRowsA.length; ra++) {
      if (mRowsA[ra][16] && mRowsA[ra][16].toString().trim().toUpperCase() === mIdA) { mRowA = mRowsA[ra]; break; }
    }
    if (!mRowA) return jsonpResponse({ status:"error", message:"Member not found." }, cbA);

    // Build payments
    var pRowsA = payshA ? payshA.getDataRange().getValues() : [], paymentsA = [], regCashA = 0, funCashA = 0;
    for (var pa = 1; pa < pRowsA.length; pa++) {
      var pidA = pRowsA[pa][1] ? pRowsA[pa][1].toString().trim() : "";
      if (!pidA || pidA.toUpperCase().indexOf(mIdA) === -1 || pidA.indexOf("REVERSED") !== -1) continue;
      var pamtA = parseFloat(pRowsA[pa][3]) || 0;
      var ptypeA = pRowsA[pa][4] ? pRowsA[pa][4].toString() : "";
      var pfundA = pRowsA[pa][6] ? pRowsA[pa][6].toString() : "";
      var pdateA = pRowsA[pa][0] ? new Date(pRowsA[pa][0]) : null;
      var pstatA = pRowsA[pa][10] ? pRowsA[pa][10].toString().trim() : "";
      if (pstatA === "UNMATCHED") continue;
      paymentsA.push({ date:pdateA?(pdateA.getMonth()+1)+"/"+pdateA.getDate()+"/"+pdateA.getFullYear():"",
        amount:pamtA, type:ptypeA, fund:pfundA||ptypeA, status:pstatA,
        memo:pRowsA[pa][8]?pRowsA[pa][8].toString():"" });
      if (ptypeA === "Registration Fee") regCashA += pamtA;
      if (ptypeA === "Funeral Contribution") funCashA += pamtA;
    }
    paymentsA.reverse();

    var priorA  = parseFloat(mRowA[15]) || 0;
    var storedA = parseFloat(mRowA[18]) || 0;
    var totCovA = regCashA + priorA + storedA;
    var regBalA = Math.max(0, cfgA.regFee - totCovA);
    var regStA  = totCovA >= cfgA.regFee ? "PAID" : (totCovA > 0 ? "PARTIAL" : "UNPAID");
    var jdA     = mRowA[0] ? new Date(mRowA[0]) : null;
    var jdStrA  = jdA ? (jdA.getMonth()+1)+"/"+jdA.getDate()+"/"+jdA.getFullYear() : "";
    var daysA   = jdA ? Math.floor((new Date()-jdA)/86400000) : 0;
    var foundA  = jdA && jdA <= new Date("2026-04-30T23:59:59");
    var waitA   = !foundA && daysA < 120 && regStA === "PAID";
    var fcredA  = Math.max(0, regCashA - cfgA.regFee) + (parseFloat(mRowA[18]) || 0);

    var fundsA = [];
    if (funshA) {
      var fRowsA = funshA.getDataRange().getValues();
      for (var ffa = 1; ffa < fRowsA.length; ffa++) {
        if (!fRowsA[ffa][0] || fRowsA[ffa][8] !== "ACTIVE") continue;
        var fcA = fRowsA[ffa][0].toString(), faA = parseFloat(fRowsA[ffa][4])||10;
        var fdlA = fRowsA[ffa][9] ? new Date(fRowsA[ffa][9]).toLocaleDateString() : "";
        var fexA = fRowsA[ffa][6] ? fRowsA[ffa][6].toString() : "";
        if (fexA.toUpperCase().indexOf(mIdA) !== -1) { fundsA.push({fund:fcA,status:"EXEMPT",owed:0,paid:0,balance:0,deadline:fdlA}); continue; }
        var fp2A = 0;
        for (var fpA = 0; fpA < paymentsA.length; fpA++) {
          if (paymentsA[fpA].fund && paymentsA[fpA].fund.toUpperCase().indexOf(fcA.toUpperCase()) !== -1) fp2A += paymentsA[fpA].amount;
        }
        fundsA.push({fund:fcA,status:Math.max(0,faA-fp2A-fcredA)<=0?"PAID":"PENDING",owed:faA,paid:fp2A,balance:Math.max(0,faA-fp2A-fcredA),deadline:fdlA});
      }
    }

    return jsonpResponse({ status:"ok", verified:true, memberId:mIdA,
      name:mRowA[2]?mRowA[2].toString():"", email:mRowA[1]?mRowA[1].toString():"",
      phone:mRowA[3]?mRowA[3].toString():"", location:mRowA[4]?mRowA[4].toString():"",
      gender:mRowA[5]?mRowA[5].toString():"", joinDate:jdStrA, daysSinceJoin:daysA,
      regFee:cfgA.regFee, regPaidCash:regCashA, priorContrib:priorA, funeralCredit:fcredA,
      totalCredit:priorA+fcredA, totalRegCovered:totCovA, regBalance:regBalA, regStatus:regStA,
      fullyEligible:regStA==="PAID"&&!waitA, inWaitingPeriod:waitA, daysRemaining120:Math.max(0,120-daysA),
      payments:paymentsA, paymentCount:paymentsA.length, totalPaid:regCashA+funCashA, activeFunds:fundsA,
      fatherName:mRowA[7]?mRowA[7].toString():"", motherName:mRowA[8]?mRowA[8].toString():"",
      spouse:mRowA[9]?mRowA[9].toString():"", children:mRowA[10]?mRowA[10].toString():"",
      siblings:mRowA[11]?mRowA[11].toString():"" }, cbA);
  }

    // ── Debug: show all payment statuses and totals ────────
  if (action === "debug_payments") {
    var ssD = _mwGetSS();
    var pdD = ssD.getSheetByName("PAYMENTS").getDataRange().getValues();
    var statTotals = {}, total = 0, dashTotal = 0;
    var skipped = [];
    for (var di = 1; di < pdD.length; di++) {
      var dPid  = pdD[di][1] ? pdD[di][1].toString().trim().toUpperCase() : "";
      var dStat = pdD[di][10] ? pdD[di][10].toString().trim() : "(blank)";
      var dAmt  = parseFloat(pdD[di][3]) || 0;
      if (!statTotals[dStat]) statTotals[dStat] = {count:0, total:0};
      statTotals[dStat].count++;
      statTotals[dStat].total += dAmt;
      total += dAmt;
      // Simulate dashboard logic
      if (!dPid || dPid === "UNMATCHED" || dPid === "DISMISSED" || dPid === "—") {
        skipped.push({row:di, pid:dPid, stat:dStat, amt:dAmt, reason:"bad pid"});
        continue;
      }
      if (dStat === "UNMATCHED" || dStat === "REVERSED") {
        skipped.push({row:di, pid:dPid, stat:dStat, amt:dAmt, reason:"reversed/unmatched"});
        continue;
      }
      var isOk = dStat && dAmt > 0 &&
        dStat !== "UNMATCHED" && dStat !== "REVERSED" &&
        dStat !== "DISMISSED" && dStat !== "PENDING" &&
        dStat !== "Status" && dStat !== "LAST PAYMENT" &&
        dStat.indexOf("SENDING") === -1 && dStat.indexOf("GMT") === -1;
      if (isOk) { dashTotal += dAmt; }
      else if (dAmt > 0) { skipped.push({row:di, pid:dPid, stat:dStat, amt:dAmt, reason:"not isConfirmed"}); }
    }
    return jsonpResponse({status:"ok", statTotals:statTotals, grandTotal:total, dashTotal:dashTotal, skipped:skipped}, params.callback||"");
  }

    // ── Clear resend rate limit (for testing) ──────────────
  if (action === "clear_limits") {
    var props = PropertiesService.getScriptProperties().getProperties();
    var cleared = 0;
    for (var k in props) {
      if (k.indexOf("RESEND_") === 0 || k.indexOf("QATTEMPT_") === 0) {
        PropertiesService.getScriptProperties().deleteProperty(k);
        cleared++;
      }
    }
    return jsonpResponse({status:"ok", cleared:cleared}, params.callback||"");
  }

  // ── Scanner health ───────────────────────────────────────
  if (action === "scanner_health") {
    var cbSH = params.callback || "";
    var props = PropertiesService.getScriptProperties();
    var lastScan  = props.getProperty("LAST_SCANNER_RUN");
    var lastCount = props.getProperty("LAST_SCANNER_COUNT") || "0";
    var lastError = props.getProperty("LAST_SCANNER_ERROR") || "";
    var nowT = Date.now();
    var ageMs    = lastScan ? nowT - parseInt(lastScan) : null;
    var ageHrs   = ageMs ? Math.round(ageMs/3600000*10)/10 : null;
    var scanStat = !lastScan ? "never_run" : ageMs < 7200000 ? "ok" : ageMs < 86400000 ? "warning" : "critical";
    return jsonpResponse({status:"ok",scannerStatus:scanStat,
      lastRun:lastScan?new Date(parseInt(lastScan)).toLocaleString():"Never",
      hoursAgo:ageHrs,lastCount:parseInt(lastCount),lastError:lastError},cbSH);
  }

  // ── Manual payment entry ──────────────────────────────────
  if (action === "manual_payment") {
    var cbMP  = params.callback || "";
    var mpId  = (params.memberId||"").toString().trim().toUpperCase();
    var mpAmt = parseFloat(params.amount) || 0;
    var mpType= (params.payType||"Registration Fee").toString().trim();
    var mpMemo= (params.memo||"MANUAL ENTRY").toString().trim();
    var mpNote= (params.note||"").toString().trim();
    if (!mpId || mpAmt <= 0) return jsonpResponse({status:"error",message:"Member ID and amount required"},cbMP);
    var ssMP = _mwGetSS(), cfgMP = _mwGetCfg(ssMP);
    var memShMP = ssMP.getSheetByName("MEMBERS");
    var payShMP = ssMP.getSheetByName("PAYMENTS");
    var mRowsMP = memShMP.getDataRange().getValues();
    var mRowMP=null, mIdxMP=-1;
    for (var rmp=1;rmp<mRowsMP.length;rmp++){
      if (mRowsMP[rmp][16]&&mRowsMP[rmp][16].toString().trim().toUpperCase()===mpId){mRowMP=mRowsMP[rmp];mIdxMP=rmp;break;}
    }
    if (!mRowMP) return jsonpResponse({status:"error",message:"Member not found: "+mpId},cbMP);
    var mNameMP=mRowMP[2]?mRowMP[2].toString():"";
    var priorMP=parseFloat(mRowMP[15])||0, credSMP=parseFloat(mRowMP[18])||0;
    var pDataMP=payShMP.getDataRange().getValues(), cashMP=0;
    for (var pmp=1;pmp<pDataMP.length;pmp++){
      if (!pDataMP[pmp][1]||pDataMP[pmp][1].toString().indexOf("REVERSED")!==-1) continue;
      if (pDataMP[pmp][1].toString().toUpperCase()!==mpId) continue;
      if ((pDataMP[pmp][4]||"").toString()==="Registration Fee") cashMP+=parseFloat(pDataMP[pmp][3])||0;
    }
    var prevBal=Math.max(0,cfgMP.regFee-cashMP-priorMP-credSMP);
    var newBal=Math.max(0,prevBal-mpAmt), excess=Math.max(0,mpAmt-prevBal);
    var now2=new Date(), newRowMP=payShMP.getLastRow()+1;
    payShMP.getRange(newRowMP,1).setValue(now2);
    payShMP.getRange(newRowMP,2).setValue(mpId);
    payShMP.getRange(newRowMP,3).setValue(mNameMP);
    payShMP.getRange(newRowMP,4).setValue(mpAmt);
    payShMP.getRange(newRowMP,5).setValue(mpType);
    payShMP.getRange(newRowMP,6).setValue("REG");
    payShMP.getRange(newRowMP,7).setValue(prevBal);
    payShMP.getRange(newRowMP,8).setValue(newBal);
    payShMP.getRange(newRowMP,9).setValue("Leadership");
    payShMP.getRange(newRowMP,10).setValue(mpMemo+(mpNote?" | "+mpNote:""));
    payShMP.getRange(newRowMP,11).setValue("MANUAL ENTRY");
    SpreadsheetApp.flush();
    var totCovMP=cashMP+mpAmt+priorMP+credSMP;
    memShMP.getRange(mIdxMP+1,20).setValue(totCovMP>=cfgMP.regFee?"YES":"PARTIAL");
    if (excess>0){var curFC=parseFloat(memShMP.getRange(mIdxMP+1,19).getValue())||0;memShMP.getRange(mIdxMP+1,19).setValue(curFC+excess);}
    SpreadsheetApp.flush();
    _mwLog("manual_payment","Manual: "+mpId+" $"+mpAmt,"OK");
    return jsonpResponse({status:"ok",message:"Payment recorded for "+mNameMP,
      memberId:mpId,name:mNameMP,amount:mpAmt,prevBalance:prevBal,newBalance:newBal,excess:excess},cbMP);
  }

  // ── Member detail update request ─────────────────────────
  if (action === "update_member") {
    var cbUM = params.callback || "";
    var umId   =(params.memberId||"").toString().trim().toUpperCase();
    var umField=(params.field||"").toString().trim();
    var umValue=(params.value||"").toString().trim();
    if (!umId||!umField||!umValue) return jsonpResponse({status:"error",message:"Missing fields"},cbUM);
    var allowedUM={"phone":4,"location":5,"emergency":13};
    if (!allowedUM[umField]) return jsonpResponse({status:"error",message:"Field not allowed: "+umField},cbUM);
    var cfgUM=_mwGetCfg(_mwGetSS());
    var reqKeyUM="UPDREQ_"+umId+"_"+umField+"_"+Date.now();
    PropertiesService.getScriptProperties().setProperty(reqKeyUM,JSON.stringify({
      memberId:umId,field:umField,value:umValue,requestedAt:new Date().toISOString(),status:"PENDING"
    }));
    _mwSendEmail(cfgUM.leaderEmail,"Update Request — "+umId+" ("+umField+")",
      umId+" requested "+umField+" change to: "+umValue,{name:cfgUM.groupName});
    _mwLog("update_member",umId+" requested: "+umField+" = "+umValue,"OK");
    return jsonpResponse({status:"ok",message:"Update request submitted. Leadership will review within 24 hours."},cbUM);
  }

  // ── Generate WhatsApp funeral fund message ───────────────
  if (action === "whatsapp_message") {
    var cbWA  = params.callback || "";
    var waFund=(params.fund||"").toString().trim();
    var waDead=(params.deceased||"").toString().trim();
    var waRel =(params.relation||"").toString().trim();
    var waBer =(params.bereaved||"").toString().trim();
    var waAmt =(params.amount||"10").toString().trim();
    var waDL  =(params.deadline||"").toString().trim();
    var cfgWA =_mwGetCfg(_mwGetSS());
        var waParts = [];
    waParts.push("*" + cfgWA.groupName.toUpperCase() + "*");
    waParts.push("");
    waParts.push("We are saddened to share the passing of *" + waDead + "*" + (waRel&&waBer ? ", " + waRel + " of *" + waBer + "*" : "") + ".");
    waParts.push("May their soul rest in eternal peace.");
    waParts.push("");
    waParts.push("*FUNERAL CONTRIBUTION - " + waFund + "*");
    waParts.push("Amount per member: *$" + waAmt + "*");
    if (waDL) waParts.push("Deadline: *" + waDL + "* (Day 14)");
    waParts.push("NOTE: $5 late fee applies from Day 15");
    waParts.push("");
    waParts.push("*How to pay:*");
    waParts.push("Zelle to: *" + cfgWA.zelleEmail + "*");
    waParts.push("Memo: *[YOUR MEMBER ID] " + waFund + "*");
    waParts.push("");
    waParts.push("Example: MW0001 " + waFund);
    waParts.push("");
    waParts.push("Automatic email confirmation sent once received. No screenshots needed.");
    waParts.push("");
    waParts.push("Thank you");
    waParts.push("- " + cfgWA.groupName + " Leadership");
    var waMsg = waParts.join("\n");
        return jsonpResponse({status:"ok",message:waMsg},cbWA);
  }

  // ── Pending update requests ───────────────────────────────
  if (action === "pending_updates") {
    var cbPU  = params.callback || "";
    var allProps = PropertiesService.getScriptProperties().getProperties();
    var pendingArr = [];
    for (var pkk in allProps) {
      if (pkk.indexOf("UPDREQ_")!==0) continue;
      try{var preqq=JSON.parse(allProps[pkk]);preqq.key=pkk;pendingArr.push(preqq);}catch(ee){}
    }
    pendingArr.sort(function(a,b){return a.requestedAt>b.requestedAt?-1:1;});
    return jsonpResponse({status:"ok",count:pendingArr.length,requests:pendingArr},cbPU);
  }

  // ── Approve update request ───────────────────────────────
  if (action === "approve_update") {
    var cbAU  = params.callback || "";
    var auKey = (params.reqKey||"").toString().trim();
    if (!auKey) return jsonpResponse({status:"error",message:"No key"},cbAU);
    var ssAU  = _mwGetSS();
    var reqStrAU = PropertiesService.getScriptProperties().getProperty(auKey);
    if (!reqStrAU) return jsonpResponse({status:"error",message:"Request not found"},cbAU);
    var reqAU  = JSON.parse(reqStrAU);
    var colMapAU={"phone":4,"location":5,"emergency":13};
    var memShAU=ssAU.getSheetByName("MEMBERS"), mRowsAU=memShAU.getDataRange().getValues();
    for (var rau=1;rau<mRowsAU.length;rau++){
      if (!mRowsAU[rau][16]||mRowsAU[rau][16].toString().trim().toUpperCase()!==reqAU.memberId) continue;
      memShAU.getRange(rau+1,colMapAU[reqAU.field]).setValue(reqAU.value);
      SpreadsheetApp.flush();
      PropertiesService.getScriptProperties().deleteProperty(auKey);
      _mwLog("approve_update",reqAU.memberId+" "+reqAU.field+" -> "+reqAU.value,"OK");
      return jsonpResponse({status:"ok",message:"Updated "+reqAU.memberId},cbAU);
    }
    return jsonpResponse({status:"error",message:"Member not found"},cbAU);
  }

    // ── Health check ────────────────────────────────────────────────────────────────────────────────────────────────
  var cb = params.callback || "";
  return jsonpResponse({
    status:  "ok",
    message: "Mgwirizano Watsopano Registration API is running",
    time:    new Date().toString()
  }, cb);
}

function jsonResponse(obj) {
  // Add CORS headers so browser fetch() calls work from any domain
  var output = ContentService.createTextOutput(JSON.stringify(obj));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

// JSONP response for verify page (browser cross-origin support)
function jsonpResponse(obj, callback) {
  if (callback) {
    var output = ContentService.createTextOutput(
      callback + "(" + JSON.stringify(obj) + ");"
    );
    output.setMimeType(ContentService.MimeType.JAVASCRIPT);
    return output;
  }
  return jsonResponse(obj);
}
