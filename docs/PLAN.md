# NovaCare implementation plan
Goal: turn the supplied clinic site into a locally runnable clinic management system.
Authorized scope: preserve the navy design, offline images, three distinct male portraits; add appointments, patients, doctors and invoices.
Architecture: Node 24 built-in HTTP + SQLite, static vanilla JS UI, localhost only. No dependency installation.
1. Verify API boundaries with node:test: authentication, CSRF, patient validation, overlapping appointments, invoice totals and overpayment, persistence and role restrictions.
2. Implement server.mjs: transactional SQLite data, password hashing, sessions, validation, public appointment intake, management APIs.
3. Implement admin.html/admin.js/admin.css: shared forms, dialogs, responsive tables, empty/loading/error states, dashboard and operational modules.
4. Update public site: stronger navy header, resilient self-contained imagery, service search, doctor selection, real server booking plus clearly labeled offline preview.
5. Run automated API/browser tests, visual checks at desktop and phone, static UI audit, independent code review, then package outputs with Windows launcher and Arabic setup guide.
Decisions: English UI retained from supplied project. Clinic timezone Africa/Cairo. Currency EGP. Native select/date controls are deliberate. First-run admin password set by owner. No online deployment, third-party messaging, prescriptions or insurance integration in this scope.
Review focus: persisted data after restart; concurrent slot conflicts; invoice rounding/overpayment; stored XSS; unauthorized write requests.
