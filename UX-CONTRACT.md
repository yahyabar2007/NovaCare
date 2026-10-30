# NovaCare UX contract
## Business context
Authority: current user selected a clinic management system with bookings, patients, doctors and invoices. Existing ZIP supplies marketing content and visual identity, not operational instructions.
Builder decisions: locally hosted single-clinic app, Cairo timezone, EGP amounts, 30-minute Mon–Sat 09:00–20:00 slots. Seed doctor identities and images are illustrative and editable. No automatic tax calculation, external payment capture, insurance claims, prescription issuing or public hosting is implied.
## Canonical UI Map
| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
|---|---|---|---|---|
| Form | admin.js field / validate / openEditor | server.mjs / this contract | Labeled controls, inline errors, first-error focus, retained input, duplicate-submit disabled | docs/VERIFICATION.md |
| Select/Listbox | Native select via field() | server.mjs / this contract | OS owns popup and keyboard behavior; app owns label, selected value and validation | docs/VERIFICATION.md |
| Date | Native date input via field() | server.mjs / this contract | ISO date-only storage; clinic uses Africa/Cairo; OS owns popup | docs/VERIFICATION.md |
| Search | searchToolbar / renderRows | server.mjs / this contract | Local filtering; clear button; no patient queries in URLs | docs/VERIFICATION.md |
| Scrollbar | admin.css universal baseline | server.mjs / this contract | Visible themed scrollbar; tables own horizontal scrolling | docs/VERIFICATION.md |
| Toast | notify() / #notice | server.mjs / this contract | Noncritical acknowledgment only; forms retain persistent errors | docs/VERIFICATION.md |
| CRUD | api / loadPage / openEditor | server.mjs / this contract | Await server success, preserve errors, refresh records, no optimistic commit | docs/VERIFICATION.md |
| Dialog | #editor native dialog | server.mjs / this contract | Focus trap/inert by browser, Escape with unsaved-change handling, close and focus restore | docs/VERIFICATION.md |
| Table | table() | server.mjs / this contract | Native table, scope headers, inner overflow, empty and no-result states | docs/VERIFICATION.md |
| Navigation | hash page + sidebar | server.mjs / this contract | Known destinations only, active state and title; admin destinations restricted on server | docs/VERIFICATION.md |
| Authentication | server sessions + login | server.mjs / this contract | HttpOnly SameSite cookie, server-side roles, 8h session, refresh on expiry | docs/VERIFICATION.md |
| Invoice | server SQLite transactions | server.mjs / this contract | Integer cents, immutable issued amount, partial payments, no overpayment | docs/VERIFICATION.md |
## Flows
Public request is pending until reception confirms. Failed request retains inputs; success displays a booking reference. Unique slot constraint prevents two non-cancelled visits for a doctor/time. Cancel releases slot; completed/cancelled visits cannot be reopened.
Patients can be created and updated; visit history uses durable IDs. Records are not destructively removed.
Admin can manage doctor availability, staff accounts, clinic information and backups. Reception can manage patient demographics, appointments, invoices and payments, but cannot change access or clinic setup.
Invoices represent internal charges, not regulated e-invoices or processor payments. Print displays paid/balance values from persisted records.
## Failure and recovery
Request errors are inline or a retryable page error. Session expiry returns to login. Unsaved open forms warn on explicit close and page unload. No credentials or patient search text stored in localStorage or URLs.
Backups are stored locally; restoration is documented with the server stopped. The localhost server is not deployed publicly.

