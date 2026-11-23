# Mgwirizano dashboard v4.3

Read **docs/AUTOMATION_AND_FIXES.md** first.

This is the complete addon update: eight Apps Script files and two website scripts, including Financial reports, running/completion messages, repeated-report protection, smarter group allocations, Zelle checks and the optional member-response/payment-follow-up assistant.

Replace the seven existing addon files, add MW_Dashboard_Automation.gs, replace both website JavaScript files and deploy a new version of the SAME Apps Script web app. Keep the existing main bridge, doGet, doPost hook and script tags.

The follow-up assistant starts DISABLED. Enable individual email switches only after reviewing the settings and acknowledgment example in Contributions & review → Action needed. Setup itself sends no messages. No production changes or emails were run while preparing this package.

See docs/INSTALL.md for previous workflow dependencies and the separate original-registration-handler limitation. Tests are synthetic and can run with Node.js from this package.
