# Verification

Verified on Windows with Node 24.22.1 and headless Microsoft Edge, 2026-10-30.

## Server
node --test tests/*.test.mjs: 22 passing tests, 0 failed. Covers auth/roles/CSRF, validation, exact slot uniqueness, cancellation, public intake, payment limits, backups and database reopening.

## Browser
- Passed: staff login and dashboard
- Passed: inline required field errors
- Passed: register patient
- Passed: search empty state and clear
- Passed: book a valid appointment using actual availability
- Passed: same-day rescheduling loads alternatives
- Passed: check in appointment
- Passed: issue invoice and record partial payment
- Passed: print invoice document populated
- Passed: dashboard mobile reflow
- Passed: public booking sent and reference displayed
- Passed: public booking appears in staff workspace
- Passed: public service search
- Passed: website mobile layout and keyboard menu
- Passed: bundled hero image loads
- Passed: no browser JavaScript errors

No page JavaScript errors. Screenshots reviewed at 1440px and 390px. A mobile activity-list overflow was found and corrected. API date normalization, falsy PATCH fields, startup retry and initial rescheduling availability findings were corrected after independent review.

Limitations: local single-machine use, English interface, no live payment processing, no external messaging, no public deployment. Not a clinical EHR or tax e-invoicing system. Browser/OS owns native date/select popup geometry.

## Final browser regression
- Passed: staff login and dashboard
- Passed: inline required field errors
- Passed: register patient
- Passed: search empty state and clear
- Passed: book a valid appointment using actual availability
- Passed: inactive doctor preserves existing appointment time
- Passed: check in appointment
- Passed: same-day rescheduling loads alternatives
- Passed: issue invoice and record partial payment
- Passed: print invoice document populated
- Passed: dashboard mobile reflow
- Passed: public booking sent and reference displayed
- Passed: public booking appears in staff workspace
- Passed: public service search
- Passed: website mobile layout and keyboard menu
- Passed: bundled hero image loads
- Passed: no browser JavaScript errors

Static UI audit: canonical mapping/evidence checks resolved. Five actionless-button warnings remain false positives: the scanner only recognizes inline onclick/Vue handlers; these buttons use external JavaScript listeners. Menu/Escape, service-clear and dialog-close handlers were exercised in the browser; logout has an explicit API handler. Inline event handlers were not introduced because the app CSP intentionally blocks them.
First-run setup was tested after a rejected short password and successfully prompted again.

## Final browser regression
- Passed: staff login and dashboard
- Passed: inline required field errors
- Passed: register patient
- Passed: search empty state and clear
- Passed: book a valid appointment using actual availability
- Passed: inactive doctor preserves existing appointment time
- Passed: check in appointment
- Passed: same-day rescheduling loads alternatives
- Passed: issue invoice and record partial payment
- Passed: print invoice document populated
- Passed: dashboard mobile reflow
- Passed: public booking sent and reference displayed
- Passed: public booking appears in staff workspace
- Passed: public service search
- Passed: website mobile layout and keyboard menu
- Passed: bundled hero image loads
- Passed: no browser JavaScript errors

Static UI audit: canonical mapping/evidence checks resolved. Five actionless-button warnings remain false positives: the scanner only recognizes inline onclick/Vue handlers; these buttons use external JavaScript listeners. Menu/Escape, service-clear and dialog-close handlers were exercised in the browser; logout has an explicit API handler. Inline event handlers were not introduced because the app CSP intentionally blocks them.
First-run setup was tested after a rejected short password and successfully prompted again.
