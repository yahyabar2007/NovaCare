---
name: NovaCare
register: hybrid
locale: en-GB
colors:
  primary: "#173f5b"
  ink: "#102f46"
  surface: "#ffffff"
  background: "#f6f7f5"
  muted: "#536674"
  border: "#dce3e4"
  success: "#246b55"
  warning: "#8d5a20"
  danger: "#a33232"
typography:
  body: "Segoe UI, Arial, sans-serif"
  display: "Georgia, serif"
spacing:
  pageDesktop: 36px
  pageMobile: 18px
rounded:
  panel: 10px
  control: 6px
omitted:
  - "dark mode: one clinic light theme and navy navigation"
---
# NovaCare design
The supplied navy clinic identity is the visual reference. Reception photography and three distinct illustrative male clinician portraits belong to the marketing surface. A dark navy workspace rail, quiet white tables and consistent status pills belong to operations. Keep promotional serif headings out of dense operational tables.

## Token ownership
Model B: runtime CSS owns tokens. admin.css :root defines --ink, --accent (primary), --paper (background), --surface, --muted, --line, --success, --warning, --danger, --radius, --body and --display. All admin modules consume these variables; this document mirrors them. Public styles.css retains its established equivalent roles --ink/--teal/--paper/--ink-soft. No external fonts required.

## Layout and behavior
Public website: existing responsive sections; stronger navy masthead and warm copper accents. CSS quadrant framing keeps the original bundled photo collage usable without editing the bitmap.
Admin: 240px desktop sidebar, 36px main inset, 4 overview metrics; below 760px horizontal navigation, 18px inset, 2-column metrics. Tables scroll inside their panels. Native dialog and labeled native date/select fields; operating-system popup appearance is deliberate.
Shared components: field(), openEditor(), table(), badge(), panel(), searchToolbar(), notify() in admin.js. Shared native validation reporting in validate(). English retained from provided files. Cairo time is explicit for appointments, EGP for payments.
Reduced-motion and forced-colors media queries are supported. Statuses use text plus color. No browser alert/confirm/prompt.

