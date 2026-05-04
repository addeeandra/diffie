# Diffie

## Constitution

Diffie is a **browser-first, local-first PostgreSQL snapshot diff tool**.

Its job is narrow:

- accept two PostgreSQL snapshots
- parse row data from `INSERT INTO ... VALUES`
- diff tables, rows, and cells
- present the result clearly on screen
- print cleanly from the browser

If future work makes Diffie broader but less trustworthy, clarity and correctness win.

## Product boundaries

### In scope

- PostgreSQL snapshots only
- browser runtime first
- local processing only
- `INSERT INTO ... VALUES` is the primary supported input
- small snapshot files first, typically under 5 MB
- table / row / cell diffing
- automatic key detection with positional fallback
- print-friendly output

### Out of scope for V1

- MySQL
- JSON input
- Laravel/backend work
- live database connections
- server-side processing
- broad “all SQL dialects” ambitions

## UX principles

- feel like a **tool**, not a marketing app
- compact, efficient, and low-friction
- calm dark theme with terminal sensibility
- visual style closer to `slowlife-app` than heavy/brutalist chrome
- filters and actions should be directly visible
- parsing/diff actions must be predictable and non-confusing
- print mode is a first-class view, not an afterthought

## Technical principles

- keep parser and diff logic pure and testable
- prefer explicit failures over silent incorrect parsing
- keep UI thin around the core logic
- use Web Workers for parse/diff work in the browser
- broaden supported SQL only with tests and clear intent
- every parsing bug should add a regression test or fixture

## Matching principles

Current matching priority:

1. detected stable key such as `id`
2. detected stable key such as `uuid`
3. table-specific singular key such as `order_id`
4. positional fallback with warning

Positional fallback is acceptable only when no stable key is available, and the UI should make that obvious.

## Current app direction

The current implementation already has:

- PostgreSQL `INSERT` parsing
- diff engine core
- worker-based parse/diff execution
- paste, upload, and drag-drop input
- parsed preview
- diff summary and per-table drilldown
- print stylesheet

## Working rule for future sessions

When making changes, preserve these priorities:

1. correctness over breadth
2. simplicity over abstraction
3. tool clarity over decorative UI
4. local privacy over convenience features
5. maintainable scope over speculative expansion

## Docs map

- `README.md` — this constitution and product guardrails
- `CONTRIBUTING.md` — setup, structure, workflow, and testing notes
- `ROADMAP.md` — implementation status and next steps
